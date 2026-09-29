import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { logAudit, setTenantStatus } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";

function tenantIdFromMetadata(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.tenant_id || null;
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/** `true` si ya se procesó este evento (idempotencia, docs/STRIPE.md §6): inserta y detecta el choque de PK. */
async function alreadyProcessed(supabase: SupabaseClient, event: Stripe.Event): Promise<boolean> {
  const { error } = await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  if (!error) return false;
  if (error.code === "23505") return true;
  throw error;
}

async function planIdForPrice(supabase: SupabaseClient, priceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("plans")
    .select("id")
    .or(`stripe_price_month.eq.${priceId},stripe_price_year.eq.${priceId}`)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function upsertSubscription(supabase: SupabaseClient, tenantId: string, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const { error } = await supabase.from("subscriptions").upsert(
    {
      tenant_id: tenantId,
      stripe_customer_id: customerId(sub.customer),
      stripe_subscription_id: sub.id,
      stripe_price_id: item.price.id,
      status: sub.status,
      collection_method: sub.collection_method,
      current_period_end: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;

  const planId = await planIdForPrice(supabase, item.price.id);
  if (planId) {
    const { error: planError } = await supabase.from("tenants").update({ plan_id: planId }).eq("id", tenantId);
    if (planError) throw planError;
  }
}

/**
 * La suscripción que generó una factura ya no viaja en `invoice.subscription` (quitado de la API
 * en versiones recientes de Stripe): ahora vive en `invoice.parent.subscription_details.subscription`.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function tenantIdFromSubscriptionId(supabase: SupabaseClient, subscriptionId: string | null): Promise<string | null> {
  if (!subscriptionId) return null;
  const { data } = await supabase
    .from("subscriptions")
    .select("tenant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return (data as { tenant_id: string } | null)?.tenant_id ?? null;
}

/**
 * Despacha un evento ya verificado (firma comprobada en la ruta) a los efectos descritos en
 * docs/STRIPE.md §6. Cada rama es idempotente por sí misma (además del filtro de `stripe_events`)
 * porque Stripe puede reintentar la entrega.
 */
export async function handleStripeEvent(event: Stripe.Event, supabase: SupabaseClient = createServiceRoleClient()): Promise<void> {
  if (await alreadyProcessed(supabase, event)) return;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.client_reference_id ?? tenantIdFromMetadata(session.metadata);
      if (!tenantId) break;
      const patch: Record<string, string> = {};
      const custId = customerId(session.customer);
      if (custId) patch.stripe_customer_id = custId;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subId) patch.stripe_subscription_id = subId;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("tenants").update(patch).eq("id", tenantId);
        if (error) throw error;
      }
      await setTenantStatus(tenantId, "active", null, null);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = tenantIdFromMetadata(sub.metadata);
      if (!tenantId) break;
      await upsertSubscription(supabase, tenantId, sub);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = tenantIdFromMetadata(sub.metadata);
      if (!tenantId) break;
      const { error } = await supabase.from("subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", sub.id);
      if (error) throw error;
      await setTenantStatus(tenantId, "canceled", "subscription_deleted", null);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await tenantIdFromSubscriptionId(supabase, invoiceSubscriptionId(invoice));
      if (!tenantId) break;
      await setTenantStatus(tenantId, "active", null, null);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await tenantIdFromSubscriptionId(supabase, invoiceSubscriptionId(invoice));
      if (!tenantId) break;
      await setTenantStatus(tenantId, "past_due", "payment_failed", null);
      break;
    }

    case "invoice.finalized": {
      // OXXO/SPEI: correo propio con la ficha/CLABE (docs/STRIPE.md §6). No hay proveedor de correo
      // transaccional en el proyecto todavía (pendiente decidir antes de live); por ahora solo se
      // registra que el evento llegó, sin bloquear la idempotencia de los demás.
      console.warn(`stripe webhook: invoice.finalized ${event.id} sin envío de correo (infra pendiente)`);
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const subId = null; // una disputa no trae subscription; se identifica por charge/customer
      void subId;
      console.warn(`stripe webhook: charge.dispute.created ${event.id} sin alerta por correo/WhatsApp (infra pendiente)`);
      await logAudit("stripe.dispute_created", null, null, { dispute_id: dispute.id, amount: dispute.amount, charge: dispute.charge });
      break;
    }

    default:
      break;
  }
}

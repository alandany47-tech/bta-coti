import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { logAudit, setTenantStatus } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendPaymentFailedEmail } from "@/lib/email/notify";

function tenantIdFromMetadata(metadata: Stripe.Metadata | null | undefined): string | null {
  return metadata?.tenant_id || null;
}

function customerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Idempotencia (docs/STRIPE.md §6): se revisa antes de procesar y se marca DESPUÉS de procesar con
 * éxito (`markProcessed`, al final de `handleStripeEvent`) — nunca antes. Si se marcara antes y el
 * procesamiento reventara a la mitad, un reintento de Stripe chocaría con la primary key y saldría
 * sin volver a intentar los efectos que sí faltaban.
 */
async function alreadyProcessed(supabase: SupabaseClient, event: Stripe.Event): Promise<boolean> {
  const { data } = await supabase.from("stripe_events").select("id").eq("id", event.id).maybeSingle();
  return Boolean(data);
}

async function markProcessed(supabase: SupabaseClient, event: Stripe.Event): Promise<void> {
  const { error } = await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  if (error && error.code !== "23505") throw error;
}

/** Si `setTenantStatus` falla por un error transitorio, hay que reventar para que Stripe reintente
 *  el webhook — devolver 200 con el tenant en el estado viejo desincroniza la cuenta en silencio. */
async function requireStatusChange(...args: Parameters<typeof setTenantStatus>): Promise<void> {
  const result = await setTenantStatus(...args);
  if (!result.ok) throw new Error(`setTenantStatus falló (${result.code}) para ${args[0]}`);
}

/**
 * Motivos de suspensión/cancelación que pone el sistema (cron, webhooks): un pago los levanta. Los
 * demás vienen de un humano (`setTenantStatus` desde el admin exige un motivo escrito, p. ej. abuso):
 * un cobro automático no puede reactivar una cuenta que el admin bloqueó aunque la suscripción siga pagándose.
 */
const SYSTEM_STATUS_REASONS = ["trial_expired", "payment_failed", "subscription_deleted"];

async function reactivateAfterPayment(supabase: SupabaseClient, tenantId: string): Promise<void> {
  const { data } = await supabase.from("tenants").select("status, status_reason").eq("id", tenantId).maybeSingle();
  const row = data as { status: string; status_reason: string | null } | null;
  const blockedByAdmin =
    row && (row.status === "suspended" || row.status === "canceled") && row.status_reason && !SYSTEM_STATUS_REASONS.includes(row.status_reason);
  if (blockedByAdmin) {
    await logAudit("stripe.reactivation_skipped", tenantId, null, { status: row.status, reason: row.status_reason });
    return;
  }
  await requireStatusChange(tenantId, "active", null, null);
}

async function planIdForPrice(supabase: SupabaseClient, priceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("plans")
    .select("id")
    .or(`stripe_price_month.eq.${priceId},stripe_price_year.eq.${priceId}`)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * `customer.subscription.created`/`updated` es lo único que dispara tanto para Checkout (tarjeta)
 * como para la suscripción creada directo con la API (SPEI, `app/api/[tenant]/billing/checkout`
 * no puede usar Checkout Sessions para SPEI/OXXO: Stripe las rechaza en `mode: "subscription"`),
 * así que aquí es donde se liga `stripe_customer_id`/`plan_id` al tenant, no en
 * `checkout.session.completed` (que para SPEI ni existe).
 *
 * Nota (revisión de Codex): esto aplica `plan_id` sin llamar a `plan_usage_overages` — a propósito.
 * `plan_usage_overages` protege el flujo propio de Checkout (docs/STRIPE.md §4, "antes del
 * downgrade, validar uso"); un cambio de plan hecho por el Portal ya llegó aquí como un hecho
 * consumado en Stripe (el Portal no expone ningún hook para bloquearlo antes). El respaldo para
 * ESE caso ya está documentado y construido: "si se superan los límites por cualquier otra vía...
 * la cuenta queda en solo lectura para crear ítems y subir medios" (§4) — lo hacen los triggers de
 * cuota existentes (`items_quota_guard`, etc.), no este webhook.
 */
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
  const patch: Record<string, string | null> = {
    stripe_subscription_id: sub.id,
    stripe_checkout_pending_at: null,
    stripe_checkout_session_id: null,
  };
  const custId = customerId(sub.customer);
  if (custId) patch.stripe_customer_id = custId;
  if (planId) patch.plan_id = planId;
  const { error: tenantError } = await supabase.from("tenants").update(patch).eq("id", tenantId);
  if (tenantError) throw tenantError;
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
 * Stripe no garantiza el orden de entrega de los webhooks: si `invoice.paid`/`invoice.payment_failed`
 * llega antes que `customer.subscription.created` haya guardado la fila en `subscriptions`, buscar
 * por `stripe_subscription_id` ahí falla y el evento se pierde para siempre (queda marcado procesado
 * igual). `subscription_details.metadata` es una foto de los metadata de la suscripción al momento
 * de facturar (docs del SDK: "immutable snapshot... at the time of invoice finalization") — no
 * depende de nuestra propia base, así que se prueba primero; la tabla queda solo de respaldo.
 */
async function tenantIdFromInvoice(supabase: SupabaseClient, invoice: Stripe.Invoice): Promise<string | null> {
  const fromMetadata = tenantIdFromMetadata(invoice.parent?.subscription_details?.metadata);
  if (fromMetadata) return fromMetadata;
  return tenantIdFromSubscriptionId(supabase, invoiceSubscriptionId(invoice));
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
      // Ligar customer/subscription al tenant lo hace `upsertSubscription` (dispara con
      // customer.subscription.created para toda suscripción, venga de Checkout o no). Esta rama
      // solo activa — y solo si ya se pagó: para medios asíncronos `payment_status` puede seguir
      // `unpaid` aquí (la instrucción de pago se mandó, pero nadie pagó todavía); activar de una vez
      // daría acceso pagado antes de que el dinero llegue. `invoice.paid` activa cuando sí se pagó.
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.client_reference_id ?? tenantIdFromMetadata(session.metadata);
      if (!tenantId || session.payment_status !== "paid") break;
      await reactivateAfterPayment(supabase, tenantId);
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
      // Se limpia stripe_subscription_id: si no, app/api/[tenant]/billing/checkout cree para siempre
      // que ya hay una suscripción activa y nunca deja arrancar una nueva (un tenant cancelado de
      // verdad tiene que poder volver a suscribirse, no solo cambiar de plan por el Portal).
      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ stripe_subscription_id: null })
        .eq("id", tenantId);
      if (tenantError) throw tenantError;
      await requireStatusChange(tenantId, "canceled", "subscription_deleted", null);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await tenantIdFromInvoice(supabase, invoice);
      if (!tenantId) break;
      await reactivateAfterPayment(supabase, tenantId);
      break;
    }

    case "invoice.payment_failed": {
      // Solo dispara para `charge_automatically` (tarjeta): una tarjeta rechazada.
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await tenantIdFromInvoice(supabase, invoice);
      if (!tenantId) break;
      await requireStatusChange(tenantId, "past_due", "payment_failed", null);
      if (invoice.id) await sendPaymentFailedEmail(tenantId, invoice.id); // T25: nunca lanza ni bloquea el webhook
      break;
    }

    case "invoice.overdue": {
      // El equivalente de invoice.payment_failed para `send_invoice` (SPEI): una factura con
      // `send_invoice` nunca dispara payment_failed aunque nadie la pague, así que sin esto una
      // suscripción SPEI que nunca se paga se queda "active"/"trialing" para siempre — y además
      // bloquea expire_trials() en cuanto queda guardado un stripe_subscription_id sin pagar nunca.
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = await tenantIdFromInvoice(supabase, invoice);
      if (!tenantId) break;
      await requireStatusChange(tenantId, "past_due", "payment_failed", null);
      if (invoice.id) await sendPaymentFailedEmail(tenantId, invoice.id);
      break;
    }

    case "invoice.finalized": {
      // SPEI: correo propio con la CLABE (docs/STRIPE.md §6). No hay proveedor de correo
      // transaccional en el proyecto todavía (pendiente decidir antes de live); por ahora solo se
      // registra que el evento llegó, sin bloquear la idempotencia de los demás.
      console.warn(`stripe webhook: invoice.finalized ${event.id} sin envío de correo (infra pendiente)`);
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      console.warn(`stripe webhook: charge.dispute.created ${event.id} sin alerta por correo/WhatsApp (infra pendiente)`);
      await logAudit("stripe.dispute_created", null, null, { dispute_id: dispute.id, amount: dispute.amount, charge: dispute.charge });
      break;
    }

    default:
      break;
  }

  await markProcessed(supabase, event);
}

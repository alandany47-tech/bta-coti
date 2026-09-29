import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { requireTenantAccess } from "@/lib/auth/api";
import { tenantOrigin } from "@/lib/auth/redirects";
import { getStripe, stripeConfigured } from "@/lib/stripe";

type CheckoutBody = {
  plan_code?: string;
  interval?: "month" | "year";
  payment_method?: "card" | "oxxo" | "spei";
};

/**
 * docs/STRIPE.md §3: tarjeta se cobra sola; OXXO/SPEI son medios "de aviso" (Stripe factura y
 * espera el pago, no hay forma de cobrarlos solos) — Checkout pone `collection_method` en
 * `send_invoice` por su cuenta al ver estos payment_method_types, no es un parámetro que se mande
 * al crear la sesión. Los 3 días de vencimiento (`days_until_due`) quedan pendientes de ajustar en
 * el webhook una vez que se pueda probar contra Stripe de verdad.
 */
const PAYMENT_METHODS: Record<NonNullable<CheckoutBody["payment_method"]>, Stripe.Checkout.SessionCreateParams.PaymentMethodType[]> = {
  card: ["card"],
  oxxo: ["oxxo"],
  spei: ["customer_balance"],
};

/**
 * Crea una Checkout Session de suscripción (docs/STRIPE.md §2-4). El cambio de estado real
 * (activar/sincronizar `subscriptions`) lo hace el webhook cuando Stripe confirma — esta ruta solo
 * arma la sesión y, si es un downgrade, lo bloquea antes de mandar al cliente a pagar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Los pagos no están disponibles todavía." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const interval = body.interval;
  const paymentMethod = body.payment_method;
  if (!body.plan_code || (interval !== "month" && interval !== "year") || !paymentMethod || !(paymentMethod in PAYMENT_METHODS)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, code, sort, stripe_price_month, stripe_price_year")
    .eq("code", body.plan_code)
    .eq("public", true)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan no encontrado." }, { status: 400 });

  const priceId = interval === "month" ? plan.stripe_price_month : plan.stripe_price_year;
  if (!priceId) {
    return NextResponse.json({ error: "Ese plan todavía no está sincronizado con Stripe." }, { status: 500 });
  }

  // Broker Pro anual no se ofrece por OXXO: pasa el tope aproximado de 10,000 MXN (docs/STRIPE.md §3).
  if (paymentMethod === "oxxo" && plan.code === "broker_pro" && interval === "year") {
    return NextResponse.json({ error: "El plan Broker Pro anual no está disponible por OXXO." }, { status: 400 });
  }

  const { data: currentTenant } = await supabase
    .from("tenants")
    .select("plan_id, stripe_customer_id")
    .eq("id", tenant.id)
    .maybeSingle();

  if (currentTenant?.plan_id && currentTenant.plan_id !== plan.id) {
    const { data: currentPlan } = await supabase.from("plans").select("sort").eq("id", currentTenant.plan_id).maybeSingle();
    const isDowngrade = Boolean(currentPlan && plan.sort < currentPlan.sort);
    if (isDowngrade) {
      const { data: overages } = await supabase.rpc("plan_usage_overages", { p_tenant: tenant.id, p_plan_code: plan.code });
      if (overages && overages.length > 0) {
        return NextResponse.json(
          { error: "El uso actual no cabe en ese plan todavía.", overages },
          { status: 409 },
        );
      }
    }
  }

  const host = request.headers.get("host") ?? "";
  const origin = tenantOrigin(slug, host);

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: tenant.id,
    customer: currentTenant?.stripe_customer_id ?? undefined,
    payment_method_types: PAYMENT_METHODS[paymentMethod],
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_options:
      paymentMethod === "spei"
        ? { customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "mx_bank_transfer" } } }
        : undefined,
    subscription_data: { metadata: { tenant_id: tenant.id } },
    metadata: { tenant_id: tenant.id },
    // T21 (Panel → Facturación) agrega esta página; hoy no existe todavía.
    success_url: `${origin}/panel/facturacion?checkout=success`,
    cancel_url: `${origin}/panel/facturacion?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}

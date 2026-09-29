import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { tenantOrigin } from "@/lib/auth/redirects";
import { getStripe, stripeConfigured } from "@/lib/stripe";

type CheckoutBody = {
  plan_code?: string;
  interval?: "month" | "year";
  payment_method?: "card" | "spei";
};

/**
 * Crea la suscripción para un plan nuevo (docs/STRIPE.md §2-4). Verificado contra Stripe de prueba
 * real (no solo contra los tipos): Checkout Sessions con `mode: "subscription"` RECHAZA tanto
 * `oxxo` como `customer_balance` ("cannot be used in `subscription` mode") — Checkout ahí solo
 * sirve para tarjeta. OXXO tampoco se puede dar de alta en una suscripción por la API directa
 * (`payment_settings.payment_method_types` ni lo acepta): Stripe no ofrece OXXO para cobros
 * recurrentes en absoluto hoy, así que se quitó de las opciones — el plan docs/STRIPE.md §3 sobre
 * OXXO recurrente no es viable con la API actual (si algún día se ofrece OXXO, sería para un pago
 * único, como la plantilla premium de §1, no para el plan). SPEI (`customer_balance`) sí funciona
 * para cobro recurrente, pero solo creando la suscripción directo con `send_invoice` y mandando al
 * cliente a la factura ya finalizada (`hosted_invoice_url`), nunca vía Checkout.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  // anyStatus: un tenant suspended/canceled es justo el que necesita pagar para reactivarse.
  const access = await requireTenantAccess(slug, "owner", { anyStatus: true });
  if (access instanceof NextResponse) return access;
  const { supabase, tenant, user } = access;

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Los pagos no están disponibles todavía." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as CheckoutBody;
  const interval = body.interval;
  const paymentMethod = body.payment_method;
  if (!body.plan_code || (interval !== "month" && interval !== "year") || (paymentMethod !== "card" && paymentMethod !== "spei")) {
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

  const { data: currentTenant } = await supabase
    .from("tenants")
    .select("plan_id, stripe_customer_id, stripe_subscription_id")
    .eq("id", tenant.id)
    .maybeSingle();

  // Un tenant que ya tiene suscripción cambia de plan por el Portal (docs/STRIPE.md §5), no
  // creando otra: si no, la vieja sigue cobrando y el webhook solo alcanza a pisar una fila local.
  if (currentTenant?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "Ya tienes una suscripción activa. Cambia de plan desde el portal de facturación." },
      { status: 409 },
    );
  }

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

  if (paymentMethod === "card") {
    const host = request.headers.get("host") ?? "";
    const origin = tenantOrigin(slug, host);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      client_reference_id: tenant.id,
      customer: currentTenant?.stripe_customer_id ?? undefined,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { tenant_id: tenant.id } },
      metadata: { tenant_id: tenant.id },
      // T21 (Panel → Facturación) agrega esta página; hoy no existe todavía.
      success_url: `${origin}/panel/facturacion?checkout=success`,
      cancel_url: `${origin}/panel/facturacion?checkout=cancel`,
    });
    return NextResponse.json({ url: session.url });
  }

  // SPEI: se crea la suscripción directo (send_invoice) y se manda al cliente a pagar la primera
  // factura ya finalizada — Checkout no admite este medio en mode: "subscription" (ver arriba).
  // Verificado contra Stripe real: un customer sin correo no puede recibir facturas `send_invoice`
  // ("Missing email"), así que aquí sí hace falta (a diferencia de la tarjeta, donde Checkout la
  // pide en su propio formulario) — se usa el correo de la sesión que está pagando.
  if (!user.email) {
    return NextResponse.json({ error: "Tu cuenta no tiene un correo válido para generar la factura." }, { status: 400 });
  }
  const stripe = getStripe();
  const customerId =
    currentTenant?.stripe_customer_id ??
    (await stripe.customers.create({ email: user.email, metadata: { tenant_id: tenant.id } })).id;

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    collection_method: "send_invoice",
    days_until_due: 3,
    payment_settings: { payment_method_types: ["customer_balance"] },
    metadata: { tenant_id: tenant.id },
  });

  const invoiceId = typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id;
  const invoice = invoiceId ? await stripe.invoices.finalizeInvoice(invoiceId) : null;
  if (!invoice?.hosted_invoice_url) {
    return NextResponse.json({ error: "No se pudo generar la ficha de pago." }, { status: 500 });
  }

  return NextResponse.json({ url: invoice.hosted_invoice_url });
}

import "server-only";
import { getStripe } from "@/lib/stripe";
import { tenantOrigin } from "@/lib/auth/redirects";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Checkout Session de tarjeta creada por el admin (alta manual con billing_mode "stripe", o el
 * botón "Generar link de Checkout" del Cliente-detalle). Igual que el Checkout del propio tenant
 * (`app/api/[tenant]/billing/checkout/route.ts`) pero sin cliente de sesión: aquí quien paga
 * todavía no tiene cuenta o el admin genera el link para mandárselo. Mensual por default; el
 * dueño puede cambiar a anual después desde el Portal.
 */
export async function createAdminCheckoutSession({
  tenantId,
  planCode,
  host,
}: {
  tenantId: string;
  planCode: string;
  host: string;
}): Promise<{ url: string } | { error: string }> {
  const supabase = createServiceRoleClient();
  const { data: plan } = await supabase.from("plans").select("stripe_price_month").eq("code", planCode).maybeSingle();
  if (!plan?.stripe_price_month) {
    return { error: `El plan ${planCode} todavía no está sincronizado con Stripe.` };
  }

  const { data: tenant } = await supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
  if (!tenant) return { error: "Tenant no encontrado." };

  const origin = tenantOrigin(tenant.slug, host);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: tenantId,
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripe_price_month, quantity: 1 }],
    subscription_data: { metadata: { tenant_id: tenantId } },
    metadata: { tenant_id: tenantId },
    success_url: `${origin}/panel/facturacion?checkout=success`,
    cancel_url: `${origin}/panel/facturacion?checkout=cancel`,
  });
  if (!session.url) return { error: "No se pudo generar el link de pago." };
  return { url: session.url };
}

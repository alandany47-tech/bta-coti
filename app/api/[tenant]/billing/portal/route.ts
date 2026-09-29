import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { tenantOrigin } from "@/lib/auth/redirects";
import { getStripe, stripeConfigured } from "@/lib/stripe";

/**
 * Sesión del Customer Portal (docs/STRIPE.md §5): usa la configuración activa de la cuenta de
 * Stripe (Dashboard → Settings → Billing → Customer portal) — ahí se activa/desactiva cada opción,
 * no en esta ruta.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Los pagos no están disponibles todavía." }, { status: 503 });
  }

  const { data: currentTenant } = await supabase
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", tenant.id)
    .maybeSingle();
  if (!currentTenant?.stripe_customer_id) {
    return NextResponse.json({ error: "Este negocio todavía no tiene una suscripción con Stripe." }, { status: 400 });
  }

  const host = request.headers.get("host") ?? "";
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: currentTenant.stripe_customer_id,
    return_url: `${tenantOrigin(slug, host)}/panel/facturacion`,
  });

  return NextResponse.json({ url: portalSession.url });
}

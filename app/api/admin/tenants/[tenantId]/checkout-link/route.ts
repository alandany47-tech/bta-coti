import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin, getTenantPlanCode } from "@/lib/admin-tenants";
import { logAudit } from "@/lib/admin-status";
import { createAdminCheckoutSession } from "@/lib/admin-billing";
import { stripeConfigured } from "@/lib/stripe";

/** Botón "Generar link de Checkout" del Cliente-detalle (docs/ADMIN-PANEL.md §2). */
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { tenantId } = await params;
  const tenant = await getTenantForAdmin(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  if (tenant.billing_mode !== "stripe") {
    return NextResponse.json({ error: "Este tenant no cobra por Stripe." }, { status: 400 });
  }
  if (tenant.stripe_subscription_id) {
    return NextResponse.json({ error: "Ya tiene una suscripción activa." }, { status: 409 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Los pagos no están disponibles todavía." }, { status: 503 });
  }

  const planCode = await getTenantPlanCode(tenantId);
  if (!planCode) return NextResponse.json({ error: "No se pudo determinar el plan del tenant." }, { status: 500 });

  const host = request.headers.get("host") ?? "";
  const result = await createAdminCheckoutSession({ tenantId, planCode, host });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });

  await logAudit("tenant.checkout_link_generated", tenantId, admin.id, {});
  return NextResponse.json({ url: result.url });
}

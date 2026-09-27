import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireTenantAccess } from "@/lib/auth/api";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { tenantOrigin } from "@/lib/auth/redirects";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { DEFAULT_TEMPLATES, renderMessage } from "@/lib/message-templates";
import { formatCurrency } from "@/lib/utils";
import { calculatePricing } from "@/lib/pricing";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";
import { buildQuoteSnapshot } from "@/lib/quote-snapshot";
import { createQuote } from "@/lib/quote-store";

type QuoteRequestBody = {
  propertyId: string;
  clientId: string;
  advisorName?: string;
  discountPct: number;
  downPaymentPct: number;
  installmentsCount: number;
  finalPaymentPct: number;
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "viewer");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant, user } = access;

  if (tenant.is_demo) {
    const limit = await checkRateLimit("demo_quote", getClientIp(request.headers));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Ya generaste varias cotizaciones de prueba. Espera un momento o crea tu cuenta gratis." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as Partial<QuoteRequestBody>;

  if (!body.propertyId || !body.clientId) {
    return NextResponse.json(
      { error: "Falta seleccionar una propiedad y un cliente." },
      { status: 400 },
    );
  }

  const { data: propertyRow, error: propertyError } = await supabase
    .from("items")
    .select(PROPERTY_COLUMNS)
    .eq("id", body.propertyId)
    .eq("tenant_id", tenant.id)
    .eq("kind", "property")
    .maybeSingle();

  if (propertyError || !propertyRow) {
    return NextResponse.json(
      { error: "La propiedad seleccionada ya no existe en la cartera." },
      { status: 400 },
    );
  }
  const property = itemToProperty(propertyRow);

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", body.clientId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (clientError || !client) {
    return NextResponse.json(
      { error: "El cliente seleccionado ya no existe." },
      { status: 400 },
    );
  }

  // El precio y el desglose financiero siempre se recalculan en el servidor contra el precio
  // real del ítem: nunca se confía en los montos que manda el navegador.
  const discountPct = Math.min(100, Math.max(0, Number(body.discountPct) || 0));
  const downPaymentPct = Math.min(100, Math.max(0, Number(body.downPaymentPct) || 0));
  const installmentsCount = Math.min(360, Math.max(1, Math.floor(Number(body.installmentsCount)) || 1));
  const breakdown = calculatePricing({
    listPrice: Number(property.list_price),
    discountPct,
    downPaymentPct,
    installmentsCount,
    finalPaymentPct: Number(body.finalPaymentPct) || 0,
  });

  const quoteId = randomUUID();
  const snapshot = buildQuoteSnapshot({
    quoteId,
    tenant,
    advisorName: body.advisorName?.trim().slice(0, 120) || null,
    clientName: client.full_name,
    clientPhone: client.phone,
    property,
    breakdown,
    installmentsCount,
    notes: body.notes?.trim().slice(0, 500) || null,
    createdAt: new Date().toISOString(),
  });

  const created = await createQuote({
    id: quoteId,
    tenantId: tenant.id,
    createdBy: user.id,
    propertyId: property.id,
    clientId: client.id,
    snapshot,
    discountPct,
    downPaymentPct,
  });
  if (!created.ok) {
    if (created.code === "quote_quota_exceeded") {
      return NextResponse.json(
        { error: "Llegaste al límite de cotizaciones de hoy en tu plan. Intenta mañana o cambia de plan." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "No se pudo registrar la cotización." }, { status: 500 });
  }

  const host = request.headers.get("host") ?? "";
  const quoteUrl = `${tenantOrigin(slug, host)}/q/${created.shareToken}`;

  const { data: template } = await supabase
    .from("message_templates")
    .select("body")
    .eq("tenant_id", tenant.id)
    .eq("module", "broker")
    .maybeSingle();
  const message = renderMessage(template?.body ?? DEFAULT_TEMPLATES.broker, {
    cliente: client.full_name,
    negocio: tenant.name,
    total: formatCurrency(breakdown.effectivePrice),
    link: quoteUrl,
    vendedor: snapshot.advisorName ?? "",
    fecha: new Date(snapshot.createdAt).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }),
    propiedad: property.title,
    unidad: property.unit_number,
    enganche: formatCurrency(breakdown.downPaymentAmount),
    mensualidad: formatCurrency(breakdown.monthlyPaymentAmount),
    plazo: String(installmentsCount),
  });
  const whatsappUrl = buildWhatsAppUrl(client.phone, message);

  return NextResponse.json({ quoteId, number: created.number, quoteUrl, whatsappUrl, breakdown });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";
import { getTenantModules } from "@/lib/catalog-admin";
import { normalizeDemoClientName, withoutLinkLines } from "@/lib/demo-quote";
import { BRAND } from "@/lib/brand";
import { DEFAULT_TEMPLATES, renderMessage } from "@/lib/message-templates";
import { buildServicesSnapshot } from "@/lib/quote-snapshot";
import { createQuote } from "@/lib/quote-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseRawLines, parseTaxPct, priceServices, resolveLines } from "@/lib/services-pricing";
import { formatCurrency } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Body = { clientId?: string; clientName?: string; lines?: unknown; taxPct?: unknown; advisorName?: string; notes?: string };

/**
 * Cotización de servicios (T30): líneas con cantidad y descuento por línea, IVA configurable.
 * Los montos se recalculan aquí; el precio de un ítem del catálogo sale SIEMPRE de la base (el
 * navegador solo manda el id y la cantidad). Solo un concepto libre trae precio del navegador: es
 * texto del propio autor de la cotización, igual que su descuento.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "viewer");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant, user } = access;

  if (!(await getTenantModules(supabase, tenant.id)).includes("services")) {
    return NextResponse.json({ error: "Tu plan no incluye cotizaciones de servicios." }, { status: 403 });
  }

  if (tenant.is_demo) {
    const limit = await checkRateLimit("demo_quote", getClientIp(request.headers));
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Ya generaste varias cotizaciones de prueba. Espera un momento o crea tu cuenta gratis." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const demoClientName = tenant.is_demo ? normalizeDemoClientName(body.clientName) : null;
  if (tenant.is_demo ? !demoClientName : !body.clientId) {
    return NextResponse.json(
      { error: tenant.is_demo ? "Escribe el nombre del cliente de prueba." : "Elige un cliente." },
      { status: 400 },
    );
  }

  const rawLines = parseRawLines(body.lines);
  if (!rawLines.ok) return NextResponse.json({ error: rawLines.error }, { status: 400 });
  const taxPct = parseTaxPct(body.taxPct ?? 0);
  if (!taxPct.ok) return NextResponse.json({ error: taxPct.error }, { status: 400 });

  const itemIds = [...new Set(rawLines.value.flatMap((l) => (l.itemId ? [l.itemId] : [])))];
  const catalog = new Map<string, { id: string; title: string; price: number | string; unit: string | null }>();
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("id, title, price, unit")
      .eq("tenant_id", tenant.id)
      .in("kind", ["service", "product"])
      .in("id", itemIds);
    for (const item of items ?? []) catalog.set(item.id, item);
  }
  const resolved = resolveLines(rawLines.value, catalog);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const pricing = priceServices(resolved.value, taxPct.value);

  let client: { id: string | null; full_name: string; phone: string };
  if (demoClientName) {
    client = { id: null, full_name: demoClientName, phone: "" };
  } else {
    const { data: clientRow } = await supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("id", body.clientId!)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!clientRow) return NextResponse.json({ error: "El cliente seleccionado ya no existe." }, { status: 400 });
    client = clientRow;
  }

  const quoteId = randomUUID();
  const snapshot = buildServicesSnapshot({
    quoteId,
    tenant,
    advisorName: body.advisorName?.trim().slice(0, 120) || null,
    clientName: client.full_name,
    clientPhone: client.phone,
    pricing,
    notes: body.notes?.trim().slice(0, 500) || null,
    createdAt: new Date().toISOString(),
  });

  const { data: template } = await supabase
    .from("message_templates")
    .select("body")
    .eq("tenant_id", tenant.id)
    .eq("module", "services")
    .maybeSingle();
  const templateBody = template?.body ?? DEFAULT_TEMPLATES.services;
  const vars = {
    cliente: client.full_name,
    negocio: tenant.name,
    total: formatCurrency(pricing.total),
    vendedor: snapshot.advisorName ?? "",
    fecha: new Date(snapshot.createdAt).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }),
  };

  if (tenant.is_demo) {
    // Nada se guarda en la demo (sesión compartida): se devuelve el snapshot para armar el PDF en el navegador.
    const host = request.headers.get("host") ?? "";
    const message = `${renderMessage(withoutLinkLines(templateBody), vars)}\n\n🧪 Cotización de prueba de la demo de ${BRAND.name}. Crea la tuya gratis: ${rootOrigin(host)}/registro`;
    return NextResponse.json({ demo: true, snapshot, whatsappUrl: buildWhatsAppUrl("", message), total: pricing.total });
  }

  const created = await createQuote({
    id: quoteId,
    tenantId: tenant.id,
    createdBy: user.id,
    propertyId: null,
    clientId: client.id!,
    snapshot,
    discountPct: 0,
    downPaymentPct: 0,
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

  const quoteUrl = `${tenantOrigin(slug, request.headers.get("host") ?? "")}/q/${created.shareToken}`;
  const whatsappUrl = buildWhatsAppUrl(client.phone, renderMessage(templateBody, { ...vars, link: quoteUrl }));
  return NextResponse.json({ quoteId, number: created.number, quoteUrl, whatsappUrl, total: pricing.total });
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireTenantAccess } from "@/lib/auth/api";
import { QuoteDocument } from "@/pdf/QuoteDocument";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { calculatePricing } from "@/lib/pricing";
import { prepareForPdf } from "@/lib/pdf-images";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";

// @react-pdf/renderer necesita APIs de Node (Buffer, fs) — no corre en Edge.
export const runtime = "nodejs";

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
  const { supabase, tenant } = access;

  const body = (await request.json()) as Partial<QuoteRequestBody>;

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

  // El precio y el desglose financiero siempre se recalculan en el servidor
  // contra el list_price real de la propiedad — nunca se confía en los
  // montos que manda el navegador.
  const breakdown = calculatePricing({
    listPrice: Number(property.list_price),
    discountPct: Number(body.discountPct) || 0,
    downPaymentPct: Number(body.downPaymentPct) || 0,
    installmentsCount: Number(body.installmentsCount) || 1,
    finalPaymentPct: Number(body.finalPaymentPct) || 0,
  });
  const installmentsCount = Math.max(1, Math.floor(Number(body.installmentsCount)) || 1);
  const notes = body.notes?.trim() || null;
  const advisorName = body.advisorName?.trim() || null;

  const quoteId = randomUUID();
  const createdAt = new Date().toISOString();

  const pdfBuffer = await renderToBuffer(
    QuoteDocument({
      tenantName: tenant.name,
      tenantLogoUrl: tenant.logo_url,
      brandColor: tenant.brand_color,
      advisorName,
      quoteId,
      clientName: client.full_name,
      clientPhone: client.phone,
      property: await prepareForPdf(property, tenant.id),
      breakdown,
      installmentsCount,
      notes,
      createdAt,
    }),
  );

  const pdfPath = `${tenant.id}/${quoteId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("quotes")
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo guardar el PDF: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("quotes").getPublicUrl(pdfPath);

  const { error: insertError } = await supabase.from("quotes").insert({
    id: quoteId,
    tenant_id: tenant.id,
    property_id: property.id,
    client_id: client.id,
    client_name: client.full_name,
    client_phone: client.phone,
    discount_pct: body.discountPct ?? 0,
    down_payment_pct: body.downPaymentPct ?? 0,
    down_payment_amount: breakdown.downPaymentAmount,
    installments_count: installmentsCount,
    monthly_payment_amount: breakdown.monthlyPaymentAmount,
    final_payment_amount: breakdown.finalPaymentAmount,
    total_amount: breakdown.effectivePrice,
    notes,
    pdf_url: publicUrl,
    status: "sent",
    created_at: createdAt,
  });

  if (insertError) {
    return NextResponse.json(
      { error: `No se pudo registrar la cotización: ${insertError.message}` },
      { status: 500 },
    );
  }

  const whatsappUrl = buildWhatsAppUrl({
    tenantName: tenant.name,
    clientName: client.full_name,
    clientPhone: client.phone,
    propertyTitle: property.title,
    propertyUnitNumber: property.unit_number,
    breakdown,
    installmentsCount,
    pdfUrl: publicUrl,
  });

  return NextResponse.json({
    quoteId,
    pdfUrl: publicUrl,
    whatsappUrl,
    breakdown,
  });
}

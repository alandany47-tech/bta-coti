import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { QuoteDocument } from "@/pdf/QuoteDocument";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { QuoteItem } from "@/lib/types";

// @react-pdf/renderer necesita APIs de Node (Buffer, fs) — no corre en Edge.
export const runtime = "nodejs";

type QuoteRequestBody = {
  clientName: string;
  clientPhone: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const body = (await request.json()) as Partial<QuoteRequestBody>;

  if (
    !body.clientName?.trim() ||
    !body.clientPhone?.trim() ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return NextResponse.json(
      { error: "Faltan datos del cliente o no hay ítems en la cotización." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  const productIds = body.items.map((item) => item.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenant.id)
    .in("id", productIds);

  if (productsError || !products || products.length !== productIds.length) {
    return NextResponse.json(
      { error: "Uno o más productos ya no existen en el catálogo." },
      { status: 400 },
    );
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  // Los precios fijos siempre se recalculan contra la BD; solo los productos
  // marcados is_custom_price aceptan el override enviado por el cliente.
  const items: QuoteItem[] = body.items.map((raw) => {
    const product = productById.get(raw.product_id)!;
    const quantity = Math.max(1, Math.floor(raw.quantity) || 1);
    const unitPrice = product.is_custom_price
      ? Math.max(0, Number(raw.unit_price) || 0)
      : Number(product.price);

    return {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      unit_price: unitPrice,
      quantity,
      is_custom_price: product.is_custom_price,
    };
  });

  const totalAmount = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );

  const quoteId = randomUUID();
  const createdAt = new Date().toISOString();

  const pdfBuffer = await renderToBuffer(
    QuoteDocument({
      tenantName: tenant.name,
      tenantLogoUrl: tenant.logo_url,
      brandColor: tenant.brand_color,
      quoteId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      items,
      totalAmount,
      createdAt,
    }),
  );

  const pdfPath = `${tenant.id}/${quoteId}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("quotes")
    .upload(pdfPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
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
    client_name: body.clientName,
    client_phone: body.clientPhone,
    items,
    total_amount: totalAmount,
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
    clientName: body.clientName,
    clientPhone: body.clientPhone,
    items,
    totalAmount,
    pdfUrl: publicUrl,
  });

  return NextResponse.json({
    quoteId,
    pdfUrl: publicUrl,
    whatsappUrl,
    totalAmount,
  });
}

import type { Property } from "@/lib/types";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import { formatCurrency } from "@/lib/utils";

/**
 * Contenido de la cotización ya resuelto (textos, montos formateados, filas): lo consumen la página web
 * y el PDF. NO recibe la plantilla a propósito: así cambiar de plantilla no puede alterar un monto ni un
 * texto, solo el aspecto (T31). Todo sale del snapshot congelado.
 */
export type QuoteViewLine = { title: string; qty: string; unitPrice: string; discount: string | null; total: string };

export type QuoteViewModel = {
  kind: "property" | "services";
  /** Texto del encabezado a la derecha ("Cotización ejecutiva" / "Cotización"). */
  metaTitle: string;
  rowsTitle: string;
  /** Solo servicios: renglones de la cotización (concepto, cantidad, precio, descuento, importe). */
  lines: QuoteViewLine[];
  folio: string;
  date: string;
  tenantName: string;
  tenantLogoUrl: string | null;
  advisorName: string | null;
  clientName: string;
  tagline: string;
  hero: { title: string; subtitle: string; status: { label: string; tone: "ok" | "warn" | "danger" } | null };
  stats: { label: string; value: string }[];
  rows: { label: string; sub: string | null; value: string; tone: "normal" | "muted" | "accent" }[];
  total: { label: string; value: string };
  notes: string | null;
  disclaimer: string;
  images: string[];
  floorPlanUrl: string | null;
  hasProperty: boolean;
  galleryTitle: string;
  sheet2Footer: string;
  brandName: string;
};

const STATUS: Record<Property["status"], { label: string; tone: "ok" | "warn" | "danger" }> = {
  available: { label: "Disponible", tone: "ok" },
  reserved: { label: "Apartado", tone: "warn" },
  sold: { label: "Vendido", tone: "danger" },
};

const area = (m2: number) => `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(m2)} m²`;
const dateFmt = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

export function buildQuoteViewModel(snapshot: QuoteSnapshot, brandName: string): QuoteViewModel {
  if (snapshot.kind === "services" && snapshot.services) return buildServicesViewModel(snapshot, brandName);
  const { property, breakdown } = snapshot;
  const folio = snapshot.number ? String(snapshot.number).padStart(4, "0") : snapshot.quoteId.slice(0, 8).toUpperCase();
  const hasDiscount = breakdown.discountAmount > 0.009;
  const hasFinal = breakdown.finalPaymentAmount > 0.009;
  const rows: QuoteViewModel["rows"] = [];

  if (property) rows.push({ label: "Precio de lista", sub: null, value: formatCurrency(property.list_price), tone: hasDiscount ? "muted" : "normal" });
  if (hasDiscount) rows.push({ label: "Descuento aplicado", sub: null, value: `− ${formatCurrency(breakdown.discountAmount)}`, tone: "accent" });
  rows.push({
    label: "Enganche",
    sub: breakdown.downPaymentAmount > 0 ? `${((breakdown.downPaymentAmount / breakdown.effectivePrice) * 100).toFixed(1)}% del precio` : "Sin enganche",
    value: formatCurrency(breakdown.downPaymentAmount),
    tone: "normal",
  });
  rows.push({
    label: "Mensualidades",
    sub: `${snapshot.installmentsCount} pagos mensuales`,
    value: `${formatCurrency(breakdown.monthlyPaymentAmount)} / mes`,
    tone: "normal",
  });
  if (hasFinal) rows.push({ label: "Saldo a escrituración", sub: "Pago único contra entrega", value: formatCurrency(breakdown.finalPaymentAmount), tone: "normal" });

  const plan = property?.floor_plan_url && !property.floor_plan_url.toLowerCase().endsWith(".pdf") ? property.floor_plan_url : null;

  return {
    kind: "property",
    metaTitle: "Cotización ejecutiva",
    rowsTitle: "Condiciones de venta",
    lines: [],
    folio,
    date: dateFmt.format(new Date(snapshot.createdAt)),
    tenantName: snapshot.tenantName,
    tenantLogoUrl: snapshot.tenantLogoUrl,
    advisorName: snapshot.advisorName,
    clientName: snapshot.clientName,
    tagline: "Dossier inmobiliario",
    hero: {
      title: property ? property.title : "Cotización",
      subtitle: `${property ? `Unidad ${property.unit_number} · ` : ""}Preparado para ${snapshot.clientName}`,
      status: property ? STATUS[property.status] : null,
    },
    stats: property
      ? [
          { label: "Unidad", value: property.unit_number },
          { label: "M² interiores", value: area(property.m2_interior) },
          { label: "M² exteriores", value: area(property.m2_exterior) },
          { label: "M² totales", value: area(property.m2_total) },
          { label: "Estacionamientos", value: String(property.parking_spaces) },
        ]
      : [],
    rows,
    total: { label: "Total de la operación", value: formatCurrency(breakdown.effectivePrice) },
    notes: snapshot.notes,
    disclaimer: `Cotización preparada por ${snapshot.tenantName} vía ${brandName} para ${snapshot.clientName} (${snapshot.clientPhone}) — folio ${folio}. Cifras informativas sujetas a disponibilidad, apartado y validación crediticia; no constituyen un contrato de compraventa.`,
    images: property?.images.slice(0, 9) ?? [],
    floorPlanUrl: plan,
    hasProperty: Boolean(property),
    galleryTitle: property ? `${property.title} · Unidad ${property.unit_number}` : "",
    sheet2Footer: `${snapshot.tenantName} · Dossier generado vía ${brandName} · Folio ${folio}`,
    brandName,
  };
}

const qtyFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

/** Servicios (T30): tabla de conceptos + Subtotal / Descuentos / IVA / Total. Sin propiedad ni segunda hoja. */
function buildServicesViewModel(snapshot: QuoteSnapshot, brandName: string): QuoteViewModel {
  const sv = snapshot.services!;
  const folio = snapshot.number ? String(snapshot.number).padStart(4, "0") : snapshot.quoteId.slice(0, 8).toUpperCase();
  const rows: QuoteViewModel["rows"] = [];
  if (sv.discountTotal > 0.009) {
    rows.push({ label: "Subtotal sin descuentos", sub: null, value: formatCurrency(sv.subtotal + sv.discountTotal), tone: "muted" });
    rows.push({ label: "Descuentos", sub: null, value: `− ${formatCurrency(sv.discountTotal)}`, tone: "accent" });
  }
  rows.push({ label: "Subtotal", sub: null, value: formatCurrency(sv.subtotal), tone: "normal" });
  rows.push({
    label: sv.taxPct > 0 ? `IVA ${qtyFmt.format(sv.taxPct)} %` : "IVA",
    sub: sv.taxPct > 0 ? null : "Precios sin IVA",
    value: formatCurrency(sv.taxAmount),
    tone: sv.taxPct > 0 ? "normal" : "muted",
  });

  return {
    kind: "services",
    metaTitle: "Cotización",
    rowsTitle: "Resumen",
    lines: sv.lines.map((l) => ({
      title: l.title,
      qty: `${qtyFmt.format(l.qty)}${l.unit ? ` ${l.unit}` : ""}`,
      unitPrice: formatCurrency(l.unitPrice),
      discount: l.discountPct > 0 ? `− ${qtyFmt.format(l.discountPct)} %` : null,
      total: formatCurrency(l.total),
    })),
    folio,
    date: dateFmt.format(new Date(snapshot.createdAt)),
    tenantName: snapshot.tenantName,
    tenantLogoUrl: snapshot.tenantLogoUrl,
    advisorName: snapshot.advisorName,
    clientName: snapshot.clientName,
    tagline: "Cotización de servicios",
    hero: { title: "Cotización de servicios", subtitle: `Preparada para ${snapshot.clientName}`, status: null },
    stats: [],
    rows,
    total: { label: "Total", value: formatCurrency(sv.total) },
    notes: snapshot.notes,
    disclaimer: `Cotización preparada por ${snapshot.tenantName} vía ${brandName} para ${snapshot.clientName}${snapshot.clientPhone ? ` (${snapshot.clientPhone})` : ""} — folio ${folio}. Importes en pesos mexicanos. Precios y disponibilidad sujetos a cambio sin previo aviso fuera de su vigencia.`,
    images: [],
    floorPlanUrl: null,
    hasProperty: false,
    galleryTitle: "",
    sheet2Footer: "",
    brandName,
  };
}

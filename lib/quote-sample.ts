import { calculatePricing } from "@/lib/pricing";
import { buildQuoteSnapshot, type QuoteSnapshot } from "@/lib/quote-snapshot";
import type { QuoteTemplateCode } from "@/lib/quote-templates";
import type { Property } from "@/lib/types";

/** Propiedad inventada para mostrar las plantillas cuando el negocio aún no carga ninguna. */
export const SAMPLE_PROPERTY: Property = {
  id: "sample",
  tenant_id: "sample",
  title: "Residencial Mirador",
  unit_number: "B-402",
  m2_interior: 86.4,
  m2_exterior: 14,
  m2_total: 100.4,
  parking_spaces: 2,
  list_price: 3_450_000,
  images: [],
  floor_plan_url: null,
  status: "available",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

/**
 * Cotización de ejemplo para la vista previa de plantillas (Panel → Plantillas): usa la marca real
 * del negocio y, si tiene, su primera propiedad real; los montos se calculan con el mismo motor.
 */
export function buildSampleSnapshot(input: {
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
  templateCode: QuoteTemplateCode;
  property?: Property | null;
  /** ISO fijo desde el servidor: así la vista previa no cambia entre el render del servidor y el del navegador. */
  createdAt: string;
}): QuoteSnapshot {
  const property = input.property ?? SAMPLE_PROPERTY;
  const breakdown = calculatePricing({ listPrice: property.list_price, discountPct: 5, downPaymentPct: 20, installmentsCount: 24, finalPaymentPct: 10 });
  return {
    ...buildQuoteSnapshot({
      quoteId: "00000000-ejemplo",
      tenant: { name: input.tenantName, logo_url: input.logoUrl, brand_color: input.brandColor, quote_template: input.templateCode },
      advisorName: "Tu nombre",
      clientName: "Cliente de ejemplo",
      clientPhone: "5512345678",
      property,
      breakdown,
      installmentsCount: 24,
      notes: "Vigencia de 30 días. Precios sujetos a disponibilidad.",
      createdAt: input.createdAt,
    }),
    number: 1,
  };
}

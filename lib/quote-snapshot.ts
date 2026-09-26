import type { PricingBreakdown } from "@/lib/pricing";
import type { Property, PublicTenant } from "@/lib/types";

/**
 * Cotización congelada: todo lo que muestran la página `/q/<token>` y el PDF. Se guarda al crear
 * la cotización; editar después el ítem, el cliente o la marca no la cambia.
 */
export type QuoteSnapshot = {
  version: 1;
  quoteId: string;
  number: number | null;
  tenantName: string;
  tenantLogoUrl: string | null;
  brandColor: string | null;
  advisorName: string | null;
  clientName: string;
  clientPhone: string;
  property: Property;
  breakdown: PricingBreakdown;
  installmentsCount: number;
  notes: string | null;
  createdAt: string;
};

const MAX_SNAPSHOT_IMAGES = 9;

export function buildQuoteSnapshot(input: {
  quoteId: string;
  tenant: Pick<PublicTenant, "name" | "logo_url" | "brand_color">;
  advisorName: string | null;
  clientName: string;
  clientPhone: string;
  property: Property;
  breakdown: PricingBreakdown;
  installmentsCount: number;
  notes: string | null;
  createdAt: string;
}): QuoteSnapshot {
  return {
    version: 1,
    quoteId: input.quoteId,
    number: null,
    tenantName: input.tenant.name,
    tenantLogoUrl: input.tenant.logo_url ?? null,
    brandColor: input.tenant.brand_color ?? null,
    advisorName: input.advisorName,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    property: { ...input.property, images: input.property.images.slice(0, MAX_SNAPSHOT_IMAGES) },
    breakdown: input.breakdown,
    installmentsCount: input.installmentsCount,
    notes: input.notes,
    createdAt: input.createdAt,
  };
}

/** Lee el jsonb de la base; null si no tiene la forma mínima (p. ej. una fila sin ítem). */
export function parseQuoteSnapshot(value: unknown): QuoteSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<QuoteSnapshot>;
  if (
    s.version !== 1 ||
    typeof s.tenantName !== "string" ||
    typeof s.clientName !== "string" ||
    !s.property ||
    typeof s.property.title !== "string" ||
    !s.breakdown ||
    typeof s.breakdown.effectivePrice !== "number"
  ) {
    return null;
  }
  return {
    ...(s as QuoteSnapshot),
    number: typeof s.number === "number" ? s.number : null,
    tenantLogoUrl: s.tenantLogoUrl ?? null,
    brandColor: s.brandColor ?? null,
    advisorName: s.advisorName ?? null,
    notes: s.notes ?? null,
    property: { ...s.property, images: s.property.images ?? [], floor_plan_url: s.property.floor_plan_url ?? null },
  };
}

import type { PricingBreakdown } from "@/lib/pricing";
import type { ServicesPricing } from "@/lib/services-pricing";
import { DEFAULT_QUOTE_TEMPLATE, isQuoteTemplateCode, type QuoteTemplateCode } from "@/lib/quote-templates";
import type { Property, PublicTenant } from "@/lib/types";

/**
 * Cotización congelada: todo lo que muestran la página `/q/<token>` y el PDF. Se guarda al crear
 * la cotización; editar después el ítem, el cliente o la marca no la cambia.
 */
export type QuoteSnapshot = {
  version: 1;
  /** `property` = cotizador inmobiliario; `services` = líneas con cantidad, descuento e IVA (T30). Las de antes son `property`. */
  kind: "property" | "services";
  quoteId: string;
  number: number | null;
  tenantName: string;
  tenantLogoUrl: string | null;
  brandColor: string | null;
  /** Plantilla con la que se hizo (T31): congelada, cambiar la del negocio después no la toca. */
  templateCode: QuoteTemplateCode;
  advisorName: string | null;
  clientName: string;
  clientPhone: string;
  property: Property | null;
  breakdown: PricingBreakdown;
  /** Solo `kind = "services"`: líneas ya calculadas. `breakdown.effectivePrice` = total con IVA. */
  services: ServicesPricing | null;
  installmentsCount: number;
  notes: string | null;
  createdAt: string;
};

const MAX_SNAPSHOT_IMAGES = 9;

export function buildQuoteSnapshot(input: {
  quoteId: string;
  tenant: Pick<PublicTenant, "name" | "logo_url" | "brand_color"> & { quote_template?: QuoteTemplateCode };
  advisorName: string | null;
  clientName: string;
  clientPhone: string;
  property: Property | null;
  breakdown: PricingBreakdown;
  installmentsCount: number;
  notes: string | null;
  createdAt: string;
}): QuoteSnapshot {
  return {
    version: 1,
    kind: "property",
    services: null,
    quoteId: input.quoteId,
    number: null,
    tenantName: input.tenant.name,
    tenantLogoUrl: input.tenant.logo_url ?? null,
    brandColor: input.tenant.brand_color ?? null,
    templateCode: input.tenant.quote_template ?? DEFAULT_QUOTE_TEMPLATE,
    advisorName: input.advisorName,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    property: input.property && { ...input.property, images: input.property.images.slice(0, MAX_SNAPSHOT_IMAGES) },
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
    (s.kind === "services" && (!s.services || !Array.isArray(s.services.lines) || typeof s.services.total !== "number")) ||
    typeof s.tenantName !== "string" ||
    typeof s.clientName !== "string" ||
    (s.property !== null && (!s.property || typeof s.property.title !== "string")) ||
    !s.breakdown ||
    typeof s.breakdown.effectivePrice !== "number"
  ) {
    return null;
  }
  return {
    ...(s as QuoteSnapshot),
    kind: s.kind === "services" ? "services" : "property",
    services: s.kind === "services" ? s.services ?? null : null,
    number: typeof s.number === "number" ? s.number : null,
    tenantLogoUrl: s.tenantLogoUrl ?? null,
    brandColor: s.brandColor ?? null,
    templateCode: isQuoteTemplateCode(s.templateCode) ? s.templateCode : DEFAULT_QUOTE_TEMPLATE,
    advisorName: s.advisorName ?? null,
    notes: s.notes ?? null,
    property: s.property ? { ...s.property, images: s.property.images ?? [], floor_plan_url: s.property.floor_plan_url ?? null } : null,
  };
}

/** Cotización de servicios: sin propiedad; el desglose financiero de propiedades queda en cero y `effectivePrice` es el total. */
export function buildServicesSnapshot(input: {
  quoteId: string;
  tenant: Pick<PublicTenant, "name" | "logo_url" | "brand_color"> & { quote_template?: QuoteTemplateCode };
  advisorName: string | null;
  clientName: string;
  clientPhone: string;
  pricing: ServicesPricing;
  notes: string | null;
  createdAt: string;
}): QuoteSnapshot {
  return {
    version: 1,
    kind: "services",
    quoteId: input.quoteId,
    number: null,
    tenantName: input.tenant.name,
    tenantLogoUrl: input.tenant.logo_url ?? null,
    brandColor: input.tenant.brand_color ?? null,
    templateCode: input.tenant.quote_template ?? DEFAULT_QUOTE_TEMPLATE,
    advisorName: input.advisorName,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    property: null,
    breakdown: {
      effectivePrice: input.pricing.total,
      discountAmount: input.pricing.discountTotal,
      downPaymentAmount: 0,
      balanceAfterDownPayment: input.pricing.total,
      installmentsTotal: 0,
      monthlyPaymentAmount: 0,
      finalPaymentAmount: 0,
    },
    services: input.pricing,
    installmentsCount: 0,
    notes: input.notes,
    createdAt: input.createdAt,
  };
}

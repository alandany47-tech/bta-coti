import type { Property, PropertyImportRow, PropertyStatus } from "@/lib/types";

/** Columnas de `items` que necesita la vista de propiedades. */
export const PROPERTY_COLUMNS =
  "id, tenant_id, title, sku, price, attrs, status, images, floor_plan_url, created_at, updated_at";

export type PropertyItemRow = {
  id: string;
  tenant_id: string;
  title: string;
  sku: string | null;
  price: number | string;
  attrs: unknown;
  status: string;
  images: string[];
  floor_plan_url: string | null;
  created_at: string;
  updated_at: string;
};

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Una fila `items` (kind = property) con la forma que usan el cotizador, el PDF y el storefront. */
export function itemToProperty(row: PropertyItemRow): Property {
  const attrs = (row.attrs && typeof row.attrs === "object" ? row.attrs : {}) as Record<string, unknown>;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: row.title,
    unit_number: typeof attrs.unit_number === "string" ? attrs.unit_number : (row.sku ?? ""),
    m2_interior: num(attrs.m2_interior),
    m2_exterior: num(attrs.m2_exterior),
    m2_total: num(attrs.m2_total),
    parking_spaces: num(attrs.parking),
    list_price: num(row.price),
    images: row.images ?? [],
    floor_plan_url: row.floor_plan_url,
    status: row.status as PropertyStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Fila del Excel de cartera → fila `items` (upsert por tenant_id + sku, con sku = unidad). */
export function importRowToItem(tenantId: string, row: PropertyImportRow) {
  const unit = row.unit_number.trim();
  const m2Interior = Math.max(0, num(row.m2_interior));
  const m2Exterior = Math.max(0, num(row.m2_exterior));
  const m2Total = num(row.m2_total) || m2Interior + m2Exterior;
  return {
    tenant_id: tenantId,
    kind: "property" as const,
    sku: unit,
    title: row.title.trim(),
    price: Math.max(0, num(row.list_price)),
    unit: "unidad",
    attrs: {
      unit_number: unit,
      m2_interior: m2Interior,
      m2_exterior: m2Exterior,
      m2_total: Math.max(0, m2Total),
      parking: Math.max(0, Math.floor(num(row.parking_spaces))),
    },
  };
}

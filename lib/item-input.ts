/** Alta y edición de productos y servicios (T32): validación pura, compartida por la API y el formulario. */

export type CatalogKind = "product" | "service";
export type CatalogStatus = "available" | "hidden";

export const ITEM_LIMITS = {
  title: 120,
  description: 1000,
  category: 40,
  unit: 24,
  sku: 40,
  detailLabel: 30,
  detailValue: 80,
  details: 8,
  maxPrice: 99_999_999.99,
} as const;

export type ItemInput = {
  kind: CatalogKind;
  title: string;
  description: string | null;
  price: number;
  unit: string | null;
  category: string | null;
  sku: string | null;
  status: CatalogStatus;
  /** Datos de la ficha (Material → Nogal): se guardan tal cual en `items.attrs`. */
  attrs: Record<string, string>;
};

/** Fila de `items` (producto o servicio) tal como la usa el panel de catálogo. */
export type CatalogRow = {
  id: string;
  kind: CatalogKind;
  title: string;
  sku: string | null;
  description: string | null;
  price: number | string;
  unit: string | null;
  category: string | null;
  attrs: unknown;
  status: "available" | "hidden";
  images: string[];
  created_at: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const clean = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

function text(value: unknown, max: number, label: string): Result<string | null> {
  const s = typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (s.length > max) return { ok: false, error: `${label}: máximo ${max} caracteres.` };
  return { ok: true, value: s === "" ? null : s };
}

function parseDetails(value: unknown): Result<Record<string, string>> {
  if (value == null) return { ok: true, value: {} };
  if (!Array.isArray(value)) return { ok: false, error: "Los datos de la ficha no son válidos." };
  const attrs: Record<string, string> = {};
  for (const row of value) {
    const label = clean((row as { label?: unknown })?.label);
    const val = clean((row as { value?: unknown })?.value);
    if (!label && !val) continue;
    if (!label || !val) return { ok: false, error: "Cada dato de la ficha necesita nombre y valor." };
    if (label.length > ITEM_LIMITS.detailLabel) return { ok: false, error: `El nombre del dato admite ${ITEM_LIMITS.detailLabel} caracteres.` };
    if (val.length > ITEM_LIMITS.detailValue) return { ok: false, error: `El valor del dato admite ${ITEM_LIMITS.detailValue} caracteres.` };
    if (label in attrs) return { ok: false, error: `El dato "${label}" está repetido.` };
    attrs[label] = val;
  }
  if (Object.keys(attrs).length > ITEM_LIMITS.details) {
    return { ok: false, error: `Máximo ${ITEM_LIMITS.details} datos en la ficha.` };
  }
  return { ok: true, value: attrs };
}

/** "1,250.50" / "$1250" → número con 2 decimales; null si no es un monto válido. */
export function parsePrice(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > ITEM_LIMITS.maxPrice) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Valida el cuerpo de POST/PATCH. `allowedKinds` sale de los módulos del plan (catalog → productos y
 * servicios; solo services → servicios). Con `partial` solo se validan los campos que vienen.
 */
export function parseItemInput(
  body: unknown,
  opts: { allowedKinds: readonly CatalogKind[]; partial?: boolean },
): Result<Partial<ItemInput>> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const has = (key: string) => key in b;
  const out: Partial<ItemInput> = {};

  if (!opts.partial || has("kind")) {
    const kind = b.kind as CatalogKind;
    if (kind !== "product" && kind !== "service") return { ok: false, error: "Elige si es producto o servicio." };
    if (!opts.allowedKinds.includes(kind)) {
      return { ok: false, error: "Tu plan no incluye ese tipo de ítem." };
    }
    out.kind = kind;
  }

  if (!opts.partial || has("title")) {
    const title = clean(b.title);
    if (!title) return { ok: false, error: "Escribe el nombre." };
    if (title.length > ITEM_LIMITS.title) return { ok: false, error: `El nombre admite ${ITEM_LIMITS.title} caracteres.` };
    out.title = title;
  }

  if (!opts.partial || has("price")) {
    const price = parsePrice(b.price);
    if (price === null) return { ok: false, error: "El precio no es válido." };
    out.price = price;
  }

  for (const [key, max, label] of [
    ["description", ITEM_LIMITS.description, "Descripción"],
    ["category", ITEM_LIMITS.category, "Categoría"],
    ["unit", ITEM_LIMITS.unit, "Unidad"],
    ["sku", ITEM_LIMITS.sku, "Código"],
  ] as const) {
    if (opts.partial && !has(key)) continue;
    const parsed = key === "description" ? text(b[key], max, label) : text(clean(b[key]), max, label);
    if (!parsed.ok) return parsed;
    out[key] = parsed.value;
  }

  if (!opts.partial || has("status")) {
    if (b.status !== "available" && b.status !== "hidden") return { ok: false, error: "Estado inválido." };
    out.status = b.status;
  }

  if (!opts.partial || has("details")) {
    const details = parseDetails(b.details);
    if (!details.ok) return details;
    out.attrs = details.value;
  }

  return { ok: true, value: out };
}

/** Módulos del plan → tipos de ítem que puede dar de alta el negocio. */
export function allowedKindsForModules(modules: readonly string[]): CatalogKind[] {
  const kinds: CatalogKind[] = [];
  if (modules.includes("catalog")) kinds.push("product");
  if (modules.includes("catalog") || modules.includes("services") || modules.includes("broker")) kinds.push("service");
  return kinds;
}

/** Los datos de la ficha (attrs) como filas editables, en el orden guardado. */
export function attrsToDetails(attrs: unknown): { label: string; value: string }[] {
  if (!attrs || typeof attrs !== "object") return [];
  return Object.entries(attrs as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([label, value]) => ({ label, value }));
}

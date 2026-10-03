/**
 * Cotización de Servicios (T30): líneas con cantidad y descuento por línea, e IVA configurable.
 * Todo en centavos enteros para que la suma de las líneas siempre cuadre con el total (nada de
 * 0.1 + 0.2). Se usa en el navegador (totales en vivo) y en el servidor, que SIEMPRE recalcula y
 * toma el precio de los ítems del catálogo desde la base, nunca del navegador.
 */
export const MAX_LINES = 50;
export const MAX_QTY = 100_000;
export const MAX_UNIT_PRICE = 99_999_999.99;
export const MAX_LINE_TITLE = 120;
export const MAX_LINE_UNIT = 24;

export type LineInput = {
  /** Ítem del catálogo (precio y nombre salen de la base); null = concepto libre. */
  itemId: string | null;
  title: string;
  unit: string | null;
  qty: number;
  unitPrice: number;
  discountPct: number;
};

export type PricedLine = LineInput & { gross: number; discount: number; total: number };

export type ServicesPricing = {
  lines: PricedLine[];
  /** Suma de las líneas ya con su descuento, antes de IVA. */
  subtotal: number;
  discountTotal: number;
  taxPct: number;
  taxAmount: number;
  total: number;
};

const cents = (amount: number) => Math.round((Number.isFinite(amount) ? amount : 0) * 100);
const fromCents = (c: number) => c / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export function priceServices(lines: readonly LineInput[], taxPct: number): ServicesPricing {
  const tax = clamp(taxPct, 0, 100);
  let subtotalC = 0;
  let discountC = 0;
  const priced = lines.map((line): PricedLine => {
    const qty = clamp(line.qty, 0, MAX_QTY);
    const pct = clamp(line.discountPct, 0, 100);
    const grossC = Math.round(qty * cents(line.unitPrice));
    const lineDiscountC = Math.round((grossC * pct) / 100);
    const totalC = grossC - lineDiscountC;
    subtotalC += totalC;
    discountC += lineDiscountC;
    return { ...line, qty, discountPct: pct, gross: fromCents(grossC), discount: fromCents(lineDiscountC), total: fromCents(totalC) };
  });
  const taxC = Math.round((subtotalC * tax) / 100);
  return {
    lines: priced,
    subtotal: fromCents(subtotalC),
    discountTotal: fromCents(discountC),
    taxPct: tax,
    taxAmount: fromCents(taxC),
    total: fromCents(subtotalC + taxC),
  };
}

// ---------------------------------------------------------------- validación (cuerpo de la petición)

/** Línea tal como la manda el navegador: el precio de un ítem del catálogo NO se acepta de aquí. */
export type RawLine = { itemId: string | null; qty: number; discountPct: number; title?: string; unit?: string | null; unitPrice?: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseTaxPct(raw: unknown): Result<number> {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, error: "El IVA debe estar entre 0 y 100 %." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

export function parseRawLines(raw: unknown): Result<RawLine[]> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Agrega al menos un concepto." };
  if (raw.length > MAX_LINES) return { ok: false, error: `Máximo ${MAX_LINES} conceptos por cotización.` };
  const out: RawLine[] = [];
  for (const row of raw) {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const qty = Math.round(Number(r.qty) * 1000) / 1000;
    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) return { ok: false, error: "La cantidad de cada concepto debe ser mayor que 0." };
    const discountPct = r.discountPct === undefined || r.discountPct === "" ? 0 : Math.round(Number(r.discountPct) * 100) / 100;
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) return { ok: false, error: "El descuento va de 0 a 100 %." };

    if (r.itemId !== null && r.itemId !== undefined) {
      if (typeof r.itemId !== "string" || !UUID_RE.test(r.itemId)) return { ok: false, error: "Concepto inválido." };
      out.push({ itemId: r.itemId, qty, discountPct });
      continue;
    }
    const title = typeof r.title === "string" ? r.title.replace(/\s+/g, " ").trim() : "";
    if (!title) return { ok: false, error: "Escribe el nombre de cada concepto libre." };
    if (title.length > MAX_LINE_TITLE) return { ok: false, error: `El nombre admite ${MAX_LINE_TITLE} caracteres.` };
    const unitPrice = Math.round(Number(r.unitPrice) * 100) / 100;
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) return { ok: false, error: "El precio de un concepto libre no es válido." };
    const unit = typeof r.unit === "string" ? r.unit.trim().slice(0, MAX_LINE_UNIT) || null : null;
    out.push({ itemId: null, qty, discountPct, title, unit, unitPrice });
  }
  return { ok: true, value: out };
}

export type CatalogLineSource = { id: string; title: string; price: number | string; unit: string | null };

/** Une las líneas del navegador con el catálogo real: los ítems toman nombre, unidad y precio de la base. */
export function resolveLines(raw: readonly RawLine[], catalog: ReadonlyMap<string, CatalogLineSource>): Result<LineInput[]> {
  const lines: LineInput[] = [];
  for (const line of raw) {
    if (line.itemId === null) {
      lines.push({ itemId: null, title: line.title ?? "", unit: line.unit ?? null, qty: line.qty, unitPrice: line.unitPrice ?? 0, discountPct: line.discountPct });
      continue;
    }
    const item = catalog.get(line.itemId);
    if (!item) return { ok: false, error: "Uno de los conceptos ya no está en tu catálogo. Quítalo e intenta de nuevo." };
    lines.push({ itemId: item.id, title: item.title, unit: item.unit, qty: line.qty, unitPrice: Number(item.price), discountPct: line.discountPct });
  }
  return { ok: true, value: lines };
}

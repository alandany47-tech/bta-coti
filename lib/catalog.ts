import { formatCurrency } from "@/lib/utils";

/**
 * Vitrina pública de catálogo (T28): filtros, "Mi cotización" y el mensaje de WhatsApp. Todo puro y
 * sin base de datos — la lista del visitante vive en su navegador (`lib/cart-store.ts`) y solo sale
 * como texto hacia el WhatsApp del negocio; no se guarda ni cotización ni cliente.
 */
export type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number;
  unit: string | null;
  images: string[];
  sku: string | null;
};

export type CartLine = { id: string; title: string; price: number; unit: string | null; qty: number };

export const MAX_CART_LINES = 30;
export const MAX_LINE_QTY = 99;
export const UNCATEGORIZED = "General";

/** Sin acentos ni mayúsculas, para que "Recamaras" encuentre "Recámaras". */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function categoryOf(item: Pick<CatalogItem, "category">): string {
  return item.category?.trim() || UNCATEGORIZED;
}

/** Categorías en el orden en que aparecen en la lista (que ya viene ordenada por `sort`). */
export function listCategories(items: Pick<CatalogItem, "category">[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(categoryOf(item), (counts.get(categoryOf(item)) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

export function filterItems<T extends CatalogItem>(items: T[], filters: { category?: string | null; query?: string }): T[] {
  const query = normalizeText(filters.query ?? "");
  return items.filter((item) => {
    if (filters.category && categoryOf(item) !== filters.category) return false;
    if (!query) return true;
    const haystack = normalizeText(`${item.title} ${item.description ?? ""} ${item.sku ?? ""} ${categoryOf(item)}`);
    return query.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function clampQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  return Math.min(MAX_LINE_QTY, Math.max(1, Math.floor(qty)));
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty, 0);
}

/** Texto del WhatsApp con la lista armada. Sin emojis ni signos de exclamación (BRAND §3). */
export function buildCartMessage(input: { businessName: string; lines: CartLine[]; catalogUrl: string }): string {
  const rows = input.lines.map(
    (line) => `- ${line.qty} × ${line.title}: ${formatCurrency(line.price * line.qty)}`,
  );
  return [
    `Hola, quiero que me cotices esto de ${input.businessName}:`,
    "",
    ...rows,
    "",
    `Total estimado: ${formatCurrency(cartTotal(input.lines))}`,
    `Catálogo: ${input.catalogUrl}`,
  ].join("\n");
}

export function buildItemMessage(input: { businessName: string; title: string; price: number; itemUrl: string }): string {
  return `Hola, me interesa "${input.title}" (${formatCurrency(input.price)}) de ${input.businessName}. ¿Está disponible?\n${input.itemUrl}`;
}

/**
 * `whatsapp`: dígitos con lada de país (`tenants.whatsapp`). Sin número, `wa.me/?text=` deja que
 * quien escribe elija el contacto en su propio WhatsApp.
 */
export function whatsappHref(whatsapp: string | null, text: string): string {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Número del panel → dígitos con lada. Un número de 10 dígitos se toma como mexicano (52); uno de
 * 11 a 15 se respeta tal cual. `null` si no sirve.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `52${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function formatWhatsappDisplay(whatsapp: string): string {
  if (whatsapp.length === 12 && whatsapp.startsWith("52")) {
    return `+52 ${whatsapp.slice(2, 4)} ${whatsapp.slice(4, 8)} ${whatsapp.slice(8)}`;
  }
  return `+${whatsapp}`;
}

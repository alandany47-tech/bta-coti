/**
 * Plantillas base de la cotización (T31): ÚNICA fuente de verdad del aspecto, la leen la página web
 * (`components/quote/quote-view.tsx`) y el PDF (`pdf/QuoteDocument.tsx`). Cambiar de plantilla solo
 * cambia el aspecto: el contenido y los montos salen de `lib/quote-view-model.ts`, que no recibe la plantilla.
 *
 * Los colores van en hex porque react-pdf no lee variables CSS (mismo caso que `emails/tokens.ts` y el
 * PDF de T15); salen de la paleta "papel y tinta" de docs/BRAND.md, no se inventan. La marca del
 * negocio (`brandColor`) entra aparte, desde el snapshot.
 *
 * El orden de `QUOTE_TEMPLATES` es el de `plans.limits.templates`: con límite N, el negocio puede
 * usar las primeras N (null = todas). La misma lista está en la migración 0034 (`set_quote_template`).
 */
export type QuoteTemplateCode = "clasica" | "moderna" | "editorial";

export type QuoteTemplate = {
  code: QuoteTemplateCode;
  name: string;
  blurb: string;
  /** `sans` = Instrument Sans / Helvetica; `serif` = Newsreader / Times. */
  font: "sans" | "serif";
  /** rule = nombre arriba y filete de marca; band = banda con el color de marca; centered = encabezado centrado. */
  header: "rule" | "band" | "centered";
  /** Características de la propiedad: dark = barra oscura; panel = tarjeta clara; inline = renglón con filetes. */
  stats: "dark" | "panel" | "inline";
  /** Segunda hoja (plano y galería). */
  gallery: "dark" | "light";
  /** text = total en color de marca; block = total en un bloque de color de marca. */
  total: "text" | "block";
  /** Radio de esquinas en px (el PDF usa el mismo número en puntos). */
  radius: number;
  colors: {
    page: string;
    ink: string;
    muted: string;
    line: string;
    /** Fondo de notas, insignias y tarjetas. */
    soft: string;
    statsBg: string;
    statsInk: string;
    statsMuted: string;
  };
  sheet2: { page: string; ink: string; muted: string; line: string; cell: string };
};

export const QUOTE_TEMPLATES: readonly QuoteTemplate[] = [
  {
    code: "clasica",
    name: "Clásica",
    blurb: "Ficha ejecutiva sobria: filete de marca, barra oscura de características y galería en negro.",
    font: "sans",
    header: "rule",
    stats: "dark",
    gallery: "dark",
    total: "text",
    radius: 6,
    colors: { page: "#FFFFFF", ink: "#18181B", muted: "#71717A", line: "#E4E4E7", soft: "#F4F4F5", statsBg: "#18181B", statsInk: "#FAFAFA", statsMuted: "#A1A1AA" },
    sheet2: { page: "#09090B", ink: "#FAFAFA", muted: "#A1A1AA", line: "#27272A", cell: "#18181B" },
  },
  {
    code: "moderna",
    name: "Moderna",
    blurb: "Banda con tu color, características en tarjeta clara y total destacado en un bloque.",
    font: "sans",
    header: "band",
    stats: "panel",
    gallery: "light",
    total: "block",
    radius: 10,
    colors: { page: "#FFFFFF", ink: "#1A1917", muted: "#6B665E", line: "#E3E0D9", soft: "#F7F6F3", statsBg: "#F7F6F3", statsInk: "#1A1917", statsMuted: "#6B665E" },
    sheet2: { page: "#F7F6F3", ink: "#1A1917", muted: "#6B665E", line: "#E3E0D9", cell: "#EFEDE8" },
  },
  {
    code: "editorial",
    name: "Editorial",
    blurb: "Tipografía con serifa, encabezado centrado y esquinas rectas: aire de revista.",
    font: "serif",
    header: "centered",
    stats: "inline",
    gallery: "light",
    total: "text",
    radius: 0,
    colors: { page: "#FBFAF7", ink: "#1A1917", muted: "#6B665E", line: "#CFCBC2", soft: "#F1EFE9", statsBg: "#FBFAF7", statsInk: "#1A1917", statsMuted: "#6B665E" },
    sheet2: { page: "#FBFAF7", ink: "#1A1917", muted: "#6B665E", line: "#CFCBC2", cell: "#EFEDE8" },
  },
] as const;

export const DEFAULT_QUOTE_TEMPLATE: QuoteTemplateCode = "clasica";

export function isQuoteTemplateCode(value: unknown): value is QuoteTemplateCode {
  return QUOTE_TEMPLATES.some((t) => t.code === value);
}

/** Plantilla por código; si el código es desconocido (snapshot viejo o dañado) cae en la clásica. */
export function getQuoteTemplate(code: unknown): QuoteTemplate {
  return QUOTE_TEMPLATES.find((t) => t.code === code) ?? QUOTE_TEMPLATES[0];
}

/** Cuántas plantillas permite el plan (`plans.limits.templates`; null = todas). */
export function templateIncludedInPlan(code: QuoteTemplateCode, limit: number | null): boolean {
  const rank = QUOTE_TEMPLATES.findIndex((t) => t.code === code) + 1;
  return limit === null || rank <= limit;
}

/** Un color de marca arbitrario (lo elige el negocio) puede ser claro: el texto encima se elige por luminancia. */
export function readableOn(background: string): "#FFFFFF" | "#1A1917" {
  const hex = /^#[0-9a-f]{6}$/i.test(background) ? background.slice(1) : "18181B";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? "#1A1917" : "#FFFFFF";
}

/** Color de marca válido o el de respaldo (tinta). */
export function safeBrandColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#18181B";
}

/** Color para TEXTO de acento (descuento, total): la marca si se lee sobre papel claro; si es clara (amarillo), la tinta. */
export function accentTextColor(brand: string, ink: string): string {
  return readableOn(brand) === "#FFFFFF" ? brand : ink;
}

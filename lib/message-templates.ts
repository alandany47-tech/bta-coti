/**
 * Mensajes de WhatsApp configurables por módulo (T16, docs/PLAN-MAESTRO.md §6). Un tenant tiene
 * una plantilla por módulo de su plan (`plans.modules`); hoy solo el cotizador de `broker` envía
 * mensajes, pero el esquema ya soporta `services`/`catalog` para cuando tengan su propio flujo.
 */
export const MODULES = ["services", "catalog", "broker"] as const;
export type MessageModule = (typeof MODULES)[number];

export const MODULE_LABEL: Record<MessageModule, string> = {
  services: "Servicios",
  catalog: "Catálogo",
  broker: "Inmobiliario",
};

export const MAX_TEMPLATE_LENGTH = 1000;

const BASE_VARIABLES = [
  { key: "cliente", label: "Cliente" },
  { key: "negocio", label: "Negocio" },
  { key: "total", label: "Total" },
  { key: "link", label: "Enlace" },
  { key: "vendedor", label: "Vendedor" },
  { key: "fecha", label: "Fecha" },
] as const;

const BROKER_VARIABLES = [
  { key: "propiedad", label: "Propiedad" },
  { key: "unidad", label: "Unidad" },
  { key: "enganche", label: "Enganche" },
  { key: "mensualidad", label: "Mensualidad" },
  { key: "plazo", label: "Plazo (meses)" },
] as const;

export const MODULE_VARIABLES: Record<MessageModule, readonly { key: string; label: string }[]> = {
  services: BASE_VARIABLES,
  catalog: BASE_VARIABLES,
  broker: [...BASE_VARIABLES, ...BROKER_VARIABLES],
};

/**
 * Estos textos son el respaldo en el cliente para "Restaurar mensaje original" y también viven
 * en `supabase/migrations/0018_message_templates.sql` (`default_message_template`), que es lo que
 * de verdad inserta `provision_tenant`: si cambias uno, cambia el otro.
 */
export const DEFAULT_TEMPLATES: Record<MessageModule, string> = {
  services:
    "Hola {cliente}, aquí tu cotización de *{negocio}* del {fecha}.\n\nTotal: {total}\n\nConsúltala y descárgala aquí: {link}",
  catalog:
    "Hola {cliente}, aquí tu cotización de *{negocio}* del {fecha}.\n\nTotal: {total}\n\nConsúltala y descárgala aquí: {link}",
  broker:
    "Hola {cliente}, aquí el desglose ejecutivo de tu cotización con *{negocio}*:\n\n🏠 {propiedad} · Unidad {unidad}\n\nPrecio: {total}\nEnganche: {enganche}\nMensualidad: {mensualidad} x {plazo} meses\n\nConsulta y descarga tu cotización: {link}",
};

export const EXAMPLE_VARS: Record<MessageModule, Record<string, string>> = {
  services: { cliente: "Ana López", negocio: "Tu negocio", total: "$4,500.00", link: "https://slug.ayx.solutions/q/abc123", vendedor: "Juan Pérez", fecha: "3 de octubre de 2026" },
  catalog: { cliente: "Ana López", negocio: "Tu negocio", total: "$12,300.00", link: "https://slug.ayx.solutions/q/abc123", vendedor: "Juan Pérez", fecha: "3 de octubre de 2026" },
  broker: {
    cliente: "Ana López", negocio: "Tu negocio", total: "$3,180,000.00", link: "https://slug.ayx.solutions/q/abc123",
    vendedor: "Juan Pérez", fecha: "3 de octubre de 2026", propiedad: "Departamento Terraza A-201", unidad: "A-201",
    enganche: "$636,000.00", mensualidad: "$106,000.00", plazo: "12",
  },
};

/** Reemplazo simple `{variable}`: una variable desconocida se deja tal cual (docs/PLAN-MAESTRO.md §6). */
export function renderMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

export function isMessageModule(value: unknown): value is MessageModule {
  return typeof value === "string" && (MODULES as readonly string[]).includes(value);
}

/** Sin HTML (docs/PLAN-MAESTRO.md §6) y dentro del máximo: la misma regla vive en la base (0018). */
export function validateTemplateBody(body: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof body !== "string") return { ok: false, error: "Solicitud inválida." };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "El mensaje no puede estar vacío." };
  if (trimmed.length > MAX_TEMPLATE_LENGTH) return { ok: false, error: `Máximo ${MAX_TEMPLATE_LENGTH} caracteres.` };
  if (trimmed.includes("<")) return { ok: false, error: "El mensaje no puede llevar HTML." };
  return { ok: true, value: trimmed };
}

/**
 * Cotización de prueba en los tenants de demo (docs/DEMO.md §2): la sesión del editor demo la
 * comparten todos los visitantes, así que nada de lo que escriban —ni el cliente ni la
 * cotización— se guarda. Solo se pide un nombre; el servidor recalcula los montos y devuelve el
 * snapshot para armar el PDF en el navegador.
 */
export const MAX_DEMO_CLIENT_NAME = 60;

/** Nombre del cliente de prueba: sin espacios repetidos, de 2 a 60 caracteres; `null` si no sirve. */
export function normalizeDemoClientName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_DEMO_CLIENT_NAME);
  return name.length >= 2 ? name : null;
}

/**
 * Una cotización de demo no se guarda, así que no hay enlace `/q/<token>` que compartir: se
 * quitan del mensaje las líneas con `{link}` (y los saltos de línea que queden de sobra).
 */
export function withoutLinkLines(template: string): string {
  return template
    .split("\n")
    .filter((line) => !line.includes("{link}"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

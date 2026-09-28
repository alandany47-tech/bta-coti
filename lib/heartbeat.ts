import "server-only";

/**
 * Ping de heartbeat al terminar un cron (docs/MONITORING.md §2: Better Stack avisa si no llega a
 * tiempo). Sin URL configurada no hace nada (dev, o mientras no exista la cuenta). Nunca revienta
 * el cron por esto: si el ping falla, solo se loguea.
 */
export async function pingHeartbeat(url: string | undefined): Promise<void> {
  if (!url) return;
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) console.error("heartbeat: respuesta no OK", url, response.status);
  } catch (error) {
    console.error("heartbeat: no se pudo avisar", url, error);
  }
}

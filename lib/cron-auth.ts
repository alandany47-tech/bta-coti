import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` configurado nada
 * pasa (mejor un cron que no corre que una ruta de mantenimiento abierta a cualquiera).
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

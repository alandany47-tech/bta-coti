import { BRAND } from "@/lib/brand";

/**
 * URLs absolutas para los correos (no hay request: el cron y los webhooks no traen `host`).
 * El dominio raíz sale de `BRAND.domain`; en local (`localhost:3100`) los subdominios son `slug.localhost:3100`.
 */
const local = BRAND.domain.includes("localhost");
const protocol = local ? "http" : "https";

export const tenantUrl = (slug: string, path = "") => `${protocol}://${slug}.${BRAND.domain}${path}`;
export const rootUrl = (path = "") => `${protocol}://${BRAND.domain}${path}`;

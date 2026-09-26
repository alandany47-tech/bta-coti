import { BRAND } from "@/lib/brand";

/** Dominio de la cookie de sesión para que `dominio.com` y `slug.dominio.com` compartan login. */
export function cookieDomainFor(host: string | null | undefined): string | undefined {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return "localhost";
  if (hostname === BRAND.domain || hostname.endsWith(`.${BRAND.domain}`)) {
    return `.${BRAND.domain}`;
  }
  return undefined;
}

import { BRAND } from "@/lib/brand";

const LABEL = /^[a-z0-9](-?[a-z0-9]){2,29}$/;

function parseHost(host: string) {
  const [hostname, port] = host.toLowerCase().split(":");
  const local = hostname === "localhost" || hostname.endsWith(".localhost");
  return { hostname, port: port ? `:${port}` : "", local };
}

export function originFromHeaders(headers: Headers): string {
  const host = headers.get("host") ?? BRAND.domain;
  const { local } = parseHost(host);
  const proto = local ? "http" : (headers.get("x-forwarded-proto") ?? "https");
  return `${proto}://${host}`;
}

export function rootOrigin(host: string): string {
  const { local, port } = parseHost(host);
  return local ? `http://localhost${port}` : `https://${BRAND.domain}`;
}

export function tenantOrigin(slug: string, host: string): string {
  const { local, port } = parseHost(host);
  return local ? `http://${slug}.localhost${port}` : `https://${slug}.${BRAND.domain}`;
}

/**
 * Devuelve `next` solo si es una ruta relativa o una URL del dominio raíz o de un
 * subdominio de tenant (mismo puerto en local). Cualquier otra cosa devuelve null.
 */
export function safeNext(next: string | null | undefined, host: string): string | null {
  if (!next) return null;
  if (/[\u0000-\u001f\\]/.test(next)) return null;

  if (next.startsWith("/")) {
    return next.startsWith("//") ? null : next;
  }

  let url: URL;
  try {
    url = new URL(next);
  } catch {
    return null;
  }

  const { local, port } = parseHost(host);
  const root = local ? "localhost" : BRAND.domain;
  if (url.protocol !== (local ? "http:" : "https:")) return null;
  if (url.username || url.password) return null;
  if (local && url.port !== port.slice(1)) return null;

  const hostname = url.hostname;
  const isRoot = hostname === root;
  const label = hostname.endsWith(`.${root}`) ? hostname.slice(0, -(root.length + 1)) : null;
  if (!isRoot && !(label && LABEL.test(label))) return null;

  return url.toString();
}

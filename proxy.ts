import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renombró `middleware.ts` a `proxy.ts` (misma funcionalidad,
 * ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 */

const ROOT_DOMAIN = (
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "btacotiza.com"
).toLowerCase();

/** Extrae el slug del tenant a partir del host (subdominio). */
function extractTenantSlug(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  // desarrollo local: cliente1.localhost:3000
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }
  if (host === "localhost" || host === "127.0.0.1") return null;

  // producción: cliente1.btacotiza.com
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && sub !== "www" ? sub : null;
  }

  return null;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const tenantSlug = extractTenantSlug(hostname);

  if (!tenantSlug) {
    return NextResponse.next();
  }

  if (url.pathname.startsWith(`/${tenantSlug}`)) {
    return NextResponse.next();
  }

  const rewrittenUrl = new URL(
    `/${tenantSlug}${url.pathname}`,
    request.url,
  );
  rewrittenUrl.search = url.search;

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

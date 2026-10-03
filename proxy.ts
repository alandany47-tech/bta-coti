import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy-session";
import { BRAND } from "@/lib/brand";

/**
 * Next.js 16 renombró `middleware.ts` a `proxy.ts` (misma funcionalidad,
 * ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * Proxy corre en runtime Node.js por default en esta versión, por eso puede
 * usar @supabase/ssr sin restricciones de Edge.
 */

const ROOT_DOMAIN = BRAND.domain;

const AUTH_PATHS = ["/admin", "/login", "/recuperar", "/registro", "/auth", "/invitacion"];

/** Extrae el slug del tenant a partir del host (subdominio). */
function extractTenantSlug(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  // desarrollo local: cliente1.localhost:3000
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }
  if (host === "localhost" || host === "127.0.0.1") return null;

  // producción: cliente1.ayxco.app
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && sub !== "www" ? sub : null;
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";
  const tenantSlug = extractTenantSlug(hostname);

  if (!tenantSlug) {
    // Dominio raíz: rutas con login. @supabase/ssr necesita reescribir las
    // cookies de sesión renovadas en cada request, algo que un Server
    // Component no puede hacer por su cuenta.
    if (AUTH_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
      const { response } = await refreshSession(request);
      return response;
    }
    return NextResponse.next();
  }

  // El proxy no consulta la base: el estado del tenant (suspendido, inexistente,
  // no operable) lo resuelve `app/[tenant]/layout.tsx` con el caché `tenant:<slug>`.
  if (url.pathname.startsWith(`/${tenantSlug}`)) {
    return NextResponse.next();
  }

  const rewrittenUrl = new URL(
    `/${tenantSlug}${url.pathname}`,
    request.url,
  );
  rewrittenUrl.search = url.search;

  // El panel usa la sesión compartida (cookie del dominio raíz): se refresca
  // aquí y las cookies renovadas viajan en la respuesta del rewrite.
  if (url.pathname === "/panel" || url.pathname.startsWith("/panel/")) {
    const { response: sessionResponse } = await refreshSession(request);
    // La ruta original (antes del rewrite a /[tenant]/panel/...) para que, si no hay sesión,
    // getPanelContext pueda mandar de vuelta a la página exacta que se pidió (lib/auth/panel.ts).
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-pathname", url.pathname + url.search);
    const rewrite = NextResponse.rewrite(rewrittenUrl, { request: { headers: requestHeaders } });
    sessionResponse.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
    return rewrite;
  }

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { refreshSession } from "@/lib/supabase/proxy-session";
import { BRAND } from "@/lib/brand";

/**
 * Next.js 16 renombró `middleware.ts` a `proxy.ts` (misma funcionalidad,
 * ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
 * Proxy corre en runtime Node.js por default en esta versión, por eso puede
 * hacer queries a Supabase y usar @supabase/ssr sin restricciones de Edge.
 */

const ROOT_DOMAIN = BRAND.domain;

const AUTH_PATHS = ["/admin", "/login", "/recuperar", "/registro", "/auth"];

/** Extrae el slug del tenant a partir del host (subdominio). */
function extractTenantSlug(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  // desarrollo local: cliente1.localhost:3000
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }
  if (host === "localhost" || host === "127.0.0.1") return null;

  // producción: cliente1.ayx.solutions
  if (host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`) return null;
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return sub && sub !== "www" ? sub : null;
  }

  return null;
}

/**
 * Solo el status — es lo único que el kill-switch necesita, y sigue siendo
 * legible con la anon key (ver GRANT/REVOKE de la migración 0003).
 * Devuelve null tanto si el tenant no existe como si hay error de red: en
 * ambos casos se debe caer al manejo de "no encontrado" ya existente, nunca
 * bloquear un tenant sano por un hipo de la base de datos.
 */
async function getTenantStatus(slug: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("status")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data.status as string;
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
      const { supabase, response } = refreshSession(request);
      await supabase.auth.getUser();
      return response;
    }
    return NextResponse.next();
  }

  // Kill-switch de suspensión: corta el acceso a CUALQUIER ruta del
  // subdominio antes de llegar a layout.tsx, sin importar qué se pidió.
  const status = await getTenantStatus(tenantSlug);
  if (status === "suspended") {
    const suspendedUrl = new URL("/suspended", request.url);
    suspendedUrl.searchParams.set("tenant", tenantSlug);
    return NextResponse.rewrite(suspendedUrl);
  }

  // Tenant inexistente o en un estado no operable (past_due/canceled): se
  // mantiene el flujo actual — layout.tsx resuelve el tenant y hace
  // notFound() si getTenantBySlug no lo considera operable.
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
    const { supabase, response: sessionResponse } = refreshSession(request);
    await supabase.auth.getUser();
    const rewrite = NextResponse.rewrite(rewrittenUrl, { request });
    sessionResponse.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
    return rewrite;
  }

  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cookieDomainFor } from "@/lib/auth/cookie-domain";

/**
 * Cliente de servidor con anon key: respeta RLS. Úsalo para lecturas
 * (resolver tenant por slug, cargar catálogo) desde Server Components.
 */
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Cliente con Service Role Key: ignora RLS. Solo se usa dentro de Route
 * Handlers para escrituras controladas por el backend (import de catálogo,
 * alta de cotizaciones). Nunca exponer esta key al cliente.
 */
export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Cliente con la sesión del usuario logueado (cookies de Supabase Auth vía
 * @supabase/ssr), para Server Components y Route Handlers del Panel Admin.
 * Respeta RLS como ese usuario — solo ve/edita tenants completos si está en
 * app_admins (ver migración 0003). Nunca usar esto para el cotizador
 * público: ahí no hay login, se usa createServerSupabaseClient (anon).
 */
export async function createSessionSupabaseClient() {
  const cookieStore = await cookies();
  const host = (await headers()).get("host");

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: cookieDomainFor(host) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // En un Server Component esto lanza si no hay respuesta que
          // pueda llevar el Set-Cookie (Next.js lo permite solo dentro de
          // Server Actions/Route Handlers). El refresh real de la sesión
          // ocurre en proxy.ts, así que acá se puede ignorar sin romper nada.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // no-op: ver comentario arriba.
          }
        },
      },
    },
  );
}

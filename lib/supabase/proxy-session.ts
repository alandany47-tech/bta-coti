import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase Auth (si existe) para requests al Panel
 * Admin: @supabase/ssr necesita que algo con acceso a la response — acá,
 * proxy.ts — reescriba las cookies renovadas en cada request, porque un
 * Server Component no puede hacer `cookies().set()` por su cuenta. Solo se
 * llama para rutas /admin*, nunca para el cotizador público (que no usa
 * Supabase Auth).
 */
export function refreshAdminSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, response };
}

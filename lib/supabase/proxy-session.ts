import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookieDomainFor } from "@/lib/auth/cookie-domain";

/**
 * Refresca la sesión de Supabase Auth (si existe) para requests a rutas con
 * login (/admin, /login, /recuperar, /auth y /panel): @supabase/ssr necesita que algo con acceso a la response — acá,
 * proxy.ts — reescriba las cookies renovadas en cada request, porque un
 * Server Component no puede hacer `cookies().set()` por su cuenta. No se
 * llama para el cotizador público (que no usa Supabase Auth).
 *
 * `getUser()` corre aquí adentro (no en el caller) porque si refresca el
 * token, `setAll` reasigna `response` a una respuesta nueva: si el caller ya
 * había desestructurado la respuesta anterior antes de llamar a `getUser()`,
 * se queda con las cookies viejas y el navegador nunca ve el refresh token
 * rotado.
 */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { domain: cookieDomainFor(request.headers.get("host")) },
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

  await supabase.auth.getUser();
  return { supabase, response };
}

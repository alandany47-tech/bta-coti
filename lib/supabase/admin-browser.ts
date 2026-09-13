import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de navegador para el login del Panel Admin. A diferencia de
 * lib/supabase/client.ts (anon puro, sin sesión, usado por el cotizador
 * público), este maneja la sesión de Supabase Auth vía cookies para que
 * Server Components/Route Handlers puedan leerla (@supabase/ssr).
 */
export function createAdminBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import "server-only";
import { createClient } from "@supabase/supabase-js";

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

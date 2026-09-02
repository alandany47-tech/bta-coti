import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador. Usa la anon key: solo puede
 * leer lo que las políticas RLS permiten (catálogo de tenants activos).
 */
export function createBrowserSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

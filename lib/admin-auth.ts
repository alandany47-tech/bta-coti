import "server-only";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Devuelve el usuario logueado solo si además está en app_admins (migración
 * 0003, vía la función is_app_admin()). null si no hay sesión o si el
 * usuario existe pero no es admin — ambos casos se tratan igual en el
 * Panel Admin: sin acceso.
 */
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  return isAdmin ? user : null;
}

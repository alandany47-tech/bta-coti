import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Resuelve emails de auth.users a partir de ids. No hay endpoint de Supabase para pedir varios de
 * una sola llamada: se dedupea y se llama getUserById por cada id único (listas siempre chicas —
 * miembros de un tenant, actores de una página de auditoría).
 */
export async function emailsByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const supabase = createServiceRoleClient();
  const entries = await Promise.all(
    unique.map(async (id) => {
      const { data } = await supabase.auth.admin.getUserById(id);
      return [id, data.user?.email ?? null] as const;
    }),
  );
  return new Map(entries.filter(([, email]) => email !== null) as [string, string][]);
}

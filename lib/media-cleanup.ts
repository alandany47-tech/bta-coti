import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { deleteObjects, listObjects, r2Configured } from "@/lib/r2";

const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // filas `pending` que nadie confirmó
const ORPHAN_GRACE_MS = 60 * 60 * 1000; // el PUT prefirmado dura 5 min; una hora cubre confirmaciones lentas
const PAGE_SIZE = 1000; // tope de filas por página que devuelve PostgREST por default

/**
 * Junta todas las páginas de `fetchPage` (PostgREST solo devuelve `pageSize` filas por request).
 * Si una página falla, revienta en vez de devolver lo que se acumuló: un resultado parcial acá
 * haría que quien lo use trate lo que falta como si no existiera (en `fetchAllMediaKeys`, eso
 * borraría de R2 medios reales que simplemente cayeron en una página que no llegó a pedirse).
 */
export async function paginateAll<T>(
  pageSize: number,
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

async function fetchAllMediaKeys(supabase: ReturnType<typeof createServiceRoleClient>): Promise<Set<string>> {
  const rows = await paginateAll<{ r2_key: string; thumb_key: string | null }>(PAGE_SIZE, async (from, to) => {
    const { data, error } = await supabase
      .from("media")
      .select("r2_key, thumb_key")
      .order("id", { ascending: true })
      .range(from, to);
    return { data, error };
  });
  const keep = new Set<string>();
  for (const row of rows) {
    keep.add(row.r2_key);
    if (row.thumb_key) keep.add(row.thumb_key);
  }
  return keep;
}

/**
 * Limpieza diaria de medios (T17): borra filas `media` `pending` abandonadas (nadie llamó
 * `/confirm`) y, de lo que quede en R2 sin fila que lo respalde, los objetos con más de una hora.
 */
export async function cleanupOrphanedMedia(): Promise<{ deletedPendingRows: number; deletedObjects: number }> {
  const supabase = createServiceRoleClient();

  const { data: stale, error: staleError } = await supabase
    .from("media")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString());
  if (staleError) throw staleError;
  const staleIds = (stale ?? []).map((row) => row.id);
  if (staleIds.length > 0) {
    const { error } = await supabase.from("media").delete().in("id", staleIds);
    if (error) throw error;
  }

  if (!r2Configured()) return { deletedPendingRows: staleIds.length, deletedObjects: 0 };

  const keep = await fetchAllMediaKeys(supabase);
  const objects = await listObjects();
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const orphans = objects.filter((o) => !keep.has(o.key) && o.lastModified.getTime() < cutoff).map((o) => o.key);
  if (orphans.length > 0) await deleteObjects(orphans);

  return { deletedPendingRows: staleIds.length, deletedObjects: orphans.length };
}

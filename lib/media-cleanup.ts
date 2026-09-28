import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { deleteObjects, listObjects, r2Configured } from "@/lib/r2";

const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000; // filas `pending` que nadie confirmó
const ORPHAN_GRACE_MS = 60 * 60 * 1000; // el PUT prefirmado dura 5 min; una hora cubre confirmaciones lentas

/**
 * Limpieza diaria de medios (T17): borra filas `media` `pending` abandonadas (nadie llamó
 * `/confirm`) y, de lo que quede en R2 sin fila que lo respalde, los objetos con más de una hora.
 */
export async function cleanupOrphanedMedia(): Promise<{ deletedPendingRows: number; deletedObjects: number }> {
  const supabase = createServiceRoleClient();

  const { data: stale } = await supabase
    .from("media")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString());
  const staleIds = (stale ?? []).map((row) => row.id);
  if (staleIds.length > 0) await supabase.from("media").delete().in("id", staleIds);

  if (!r2Configured()) return { deletedPendingRows: staleIds.length, deletedObjects: 0 };

  const { data: rows } = await supabase.from("media").select("r2_key, thumb_key");
  const keep = new Set<string>();
  for (const row of rows ?? []) {
    keep.add(row.r2_key);
    if (row.thumb_key) keep.add(row.thumb_key);
  }

  const objects = await listObjects();
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const orphans = objects.filter((o) => !keep.has(o.key) && o.lastModified.getTime() < cutoff).map((o) => o.key);
  if (orphans.length > 0) await deleteObjects(orphans);

  return { deletedPendingRows: staleIds.length, deletedObjects: orphans.length };
}

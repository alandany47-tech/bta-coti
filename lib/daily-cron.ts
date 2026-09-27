import "server-only";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tenantTag } from "@/lib/tenants";
import { deleteObjects, listObjects, r2Configured } from "@/lib/r2";

/**
 * Tareas del cron diario (T17, `/api/cron/daily`). Cada una es idempotente y no depende de las
 * otras: si una falla, las demás corren igual y la siguiente ejecución retoma lo pendiente.
 */

/** Pruebas vencidas → `suspended` (`trial_expired`), con auditoría en la base (0022). */
export async function expireTrials(): Promise<{ expired: string[] }> {
  const { data, error } = await createServiceRoleClient().rpc("expire_trials");
  if (error) throw new Error(`expire_trials: ${error.message}`);
  const slugs = (data ?? []).map((row: { slug: string }) => row.slug);
  // Cambio de estado → el caché del tenant debe verlo ya (proxy/layout lo leen de ahí).
  for (const slug of slugs) revalidateTag(tenantTag(slug), { expire: 0 });
  return { expired: slugs };
}

/** Pone en 0 `usage.quotes_this_month` de los tenants cuyo contador es de un mes anterior. */
export async function resetMonthlyQuotes(): Promise<{ reset: number }> {
  const { data, error } = await createServiceRoleClient().rpc("reset_monthly_quotes");
  if (error) throw new Error(`reset_monthly_quotes: ${error.message}`);
  return { reset: data ?? 0 };
}

/** Objetos más nuevos que esto no se tocan: una subida en curso aún no tiene fila `ready`. */
export const ORPHAN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type OrphanSweep = {
  skipped?: "r2_not_configured";
  pendingPurged: number;
  scanned: number;
  deleted: number;
  failed: number;
  complete: boolean;
};

/**
 * 1) Borra las reservas `pending` vencidas y sus objetos. 2) Recorre `t/` en R2 y borra lo que la
 * base no referencia (`orphan_media_keys`) y tiene más de 24 h. Se detiene al pasar `deadline`
 * (la siguiente corrida vuelve a empezar: lo ya borrado ya no aparece en el listado).
 */
export async function sweepR2Orphans({
  now = Date.now(),
  deadline = Number.POSITIVE_INFINITY,
}: { now?: number; deadline?: number } = {}): Promise<OrphanSweep> {
  const result: OrphanSweep = { pendingPurged: 0, scanned: 0, deleted: 0, failed: 0, complete: false };
  if (!r2Configured()) return { ...result, skipped: "r2_not_configured", complete: true };

  const supabase = createServiceRoleClient();

  const { data: stale, error: staleError } = await supabase.rpc("purge_stale_pending_media", {});
  if (staleError) throw new Error(`purge_stale_pending_media: ${staleError.message}`);
  const staleKeys = (stale ?? []).flatMap((row: { r2_key: string; thumb_key: string | null }) => [row.r2_key, row.thumb_key]);
  result.pendingPurged = stale?.length ?? 0;
  result.failed += await deleteObjects(staleKeys);

  const cutoff = now - ORPHAN_MIN_AGE_MS;
  let token: string | null = null;
  do {
    if (Date.now() > deadline) return result;
    const page = await listObjects("t/", token);
    token = page.next;
    result.scanned += page.objects.length;

    const candidates = page.objects.filter((o) => o.lastModified.getTime() < cutoff).map((o) => o.key);
    if (candidates.length === 0) continue;

    const { data: orphans, error } = await supabase.rpc("orphan_media_keys", { p_keys: candidates });
    if (error) throw new Error(`orphan_media_keys: ${error.message}`);
    const keys = (orphans ?? []) as string[];
    if (keys.length === 0) continue;

    const failed = await deleteObjects(keys);
    result.failed += failed;
    result.deleted += keys.length - failed;
  } while (token);

  result.complete = true;
  return result;
}

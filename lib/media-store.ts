import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Único lugar fuera de admin/cron/provisión que usa la service role: las funciones de medios
 * (0010) solo las ejecuta la service role. Quien llame debe haber validado ya sesión, rol de
 * editor y (al confirmar) el tamaño real del objeto en R2.
 */
export type MediaErrorCode =
  | "storage_quota_exceeded"
  | "item_media_limit"
  | "tenant_not_operable"
  | "media_not_found"
  | "media_in_use"
  | "error";

function code(message: string): MediaErrorCode {
  for (const known of ["storage_quota_exceeded", "item_media_limit", "tenant_not_operable", "media_not_found", "media_in_use"] as const) {
    if (message.includes(known)) return known;
  }
  return "error";
}

export async function reserveMedia(input: {
  tenantId: string;
  itemId: string | null;
  kind: string;
  contentType: string;
  bytes: number;
  thumbBytes: number;
  width: number | null;
  height: number | null;
}) {
  const { data, error } = await createServiceRoleClient().rpc("reserve_media", {
    p_tenant: input.tenantId,
    p_item: input.itemId as string,
    p_kind: input.kind,
    p_content_type: input.contentType,
    p_bytes: input.bytes,
    p_thumb_bytes: input.thumbBytes,
    p_width: input.width as number,
    p_height: input.height as number,
  });
  if (error || !data?.[0]) {
    if (error && code(error.message) === "error") console.error("reserve_media falló", error.message);
    return { ok: false as const, code: error ? code(error.message) : ("error" as MediaErrorCode) };
  }
  return { ok: true as const, media: data[0] };
}

export async function getPendingMedia(id: string, tenantId: string) {
  const { data } = await createServiceRoleClient()
    .from("media")
    .select("id, item_id, kind, status, r2_key, thumb_key, content_type, bytes, thumb_bytes")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data;
}

export async function confirmMedia(id: string, tenantId: string, bytes: number, thumbBytes: number) {
  const { error } = await createServiceRoleClient().rpc("confirm_media", {
    p_id: id,
    p_tenant: tenantId,
    p_bytes: bytes,
    p_thumb_bytes: thumbBytes,
  });
  if (error && code(error.message) === "error") console.error("confirm_media falló", error.message);
  return error ? { ok: false as const, code: code(error.message) } : { ok: true as const };
}

/** Borra la fila (el trigger descuenta usage) y devuelve las llaves para borrar en R2. */
export type DeleteMediaResult =
  | { ok: true; r2_key: string; thumb_key: string | null }
  | { ok: false; code: MediaErrorCode };

/**
 * Borra la fila (el trigger descuenta usage) y devuelve las llaves para borrar en R2. Falla con
 * `media_in_use` si el medio está en el snapshot de una cotización enviada y todavía vigente
 * (docs/ROADMAP.md T15: editar un ítem no cambia una cotización ya enviada).
 */
export async function deleteMedia(id: string, tenantId: string): Promise<DeleteMediaResult> {
  const { data, error } = await createServiceRoleClient().rpc("delete_media", { p_id: id, p_tenant: tenantId });
  if (error) {
    const errorCode = code(error.message);
    if (errorCode === "error") console.error("delete_media falló", error.message);
    return { ok: false, code: errorCode };
  }
  const row = data?.[0];
  if (!row) return { ok: false, code: "media_not_found" };
  return { ok: true, r2_key: row.r2_key, thumb_key: row.thumb_key };
}

/**
 * Cuando `deleteMedia` falla con `media_in_use`, el medio ya se quitó de `item.images` pero se
 * queda en la base: márcalo para que el cron diario (T17) reintente borrarlo una vez que venza la
 * cotización que lo bloquea (`retry_detached_media_deletes`, 0024).
 */
export async function markMediaDetached(id: string, tenantId: string) {
  const { error } = await createServiceRoleClient().rpc("mark_media_detached", { p_id: id, p_tenant: tenantId });
  if (error) console.error("mark_media_detached falló", error.message);
}

export type PropertyMedia = { images: string[]; floor_plan_url: string | null };

/** Liga la URL del CDN a `items.images` / `floor_plan_url` (0012) y devuelve el estado resultante. */
export async function attachMediaUrl(
  tenantId: string,
  itemId: string,
  kind: string,
  url: string,
): Promise<PropertyMedia | null> {
  const { data, error } = await createServiceRoleClient().rpc("attach_media_url", {
    p_tenant: tenantId,
    p_item: itemId,
    p_kind: kind,
    p_url: url,
  });
  if (error || !data?.[0]) {
    console.error("attach_media_url falló", error?.message);
    return null;
  }
  return data[0];
}

export async function detachMediaUrl(tenantId: string, url: string) {
  const { error } = await createServiceRoleClient().rpc("detach_media_url", { p_tenant: tenantId, p_url: url });
  if (error) console.error("detach_media_url falló", error.message);
}

export async function listItemMedia(tenantId: string, itemId: string, kind: string, exceptId: string) {
  const { data } = await createServiceRoleClient()
    .from("media")
    .select("id, r2_key, thumb_key")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .eq("kind", kind)
    .neq("id", exceptId);
  return data ?? [];
}

/** Liga la URL del CDN a `tenants.logo_url` (T23) — la única variante de medio sin `item_id`. */
export async function setTenantLogo(tenantId: string, url: string) {
  const { error } = await createServiceRoleClient().rpc("set_tenant_logo", { p_tenant: tenantId, p_url: url });
  if (error) console.error("set_tenant_logo falló", error.message);
  return !error;
}

/** Como `listItemMedia` pero para medios sin `item_id` (hoy solo `kind: "logo"`). */
export async function listTenantMedia(tenantId: string, kind: string, exceptId: string) {
  const { data } = await createServiceRoleClient()
    .from("media")
    .select("id, r2_key, thumb_key")
    .eq("tenant_id", tenantId)
    .is("item_id", null)
    .eq("kind", kind)
    .neq("id", exceptId);
  return data ?? [];
}

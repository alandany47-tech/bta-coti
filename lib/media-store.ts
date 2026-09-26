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
  | "error";

function code(message: string): MediaErrorCode {
  for (const known of ["storage_quota_exceeded", "item_media_limit", "tenant_not_operable", "media_not_found"] as const) {
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
    .select("id, kind, status, r2_key, thumb_key, content_type, bytes, thumb_bytes")
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
export async function deleteMedia(id: string, tenantId: string) {
  const { data, error } = await createServiceRoleClient().rpc("delete_media", { p_id: id, p_tenant: tenantId });
  if (error) console.error("delete_media falló", error.message);
  return data?.[0] ?? null;
}

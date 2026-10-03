import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid, mediaUrl } from "@/lib/media";
import { deleteMedia, markMediaDetached } from "@/lib/media-store";
import { deleteObjects, r2Configured } from "@/lib/r2";

/**
 * Reordena o quita imágenes de un ítem (propiedad, producto o servicio). Solo acepta un subconjunto de las URLs actuales
 * (nunca URLs nuevas: esas las agrega el servidor al confirmar la subida a R2). Si una URL que se
 * quita es un medio de R2 (no una imagen legada de Storage), también se borra su fila en `media`
 * y el objeto en R2: si no, la subida seguiría contando en la cuota del tenant aunque ya no se
 * viera en ningún lado.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant: string; itemId: string }> },
) {
  const { tenant: slug, itemId } = await params;
  if (!isUuid(itemId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  if (tenant.is_demo) {
    return NextResponse.json({ error: "La demo no permite editar la galería." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { images?: unknown; floor_plan_url?: unknown } | null;
  const clearPlan = body?.floor_plan_url === null;
  const hasImages = Array.isArray(body?.images) && body.images.every((u) => typeof u === "string");
  if (!hasImages && !clearPlan) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const { data: property } = await supabase
    .from("items")
    .select("id, images, floor_plan_url")
    .eq("id", itemId)
    .eq("tenant_id", tenant.id)
    .in("kind", ["product", "service", "property"])
    .maybeSingle();
  if (!property) return NextResponse.json({ error: "Ítem no encontrado." }, { status: 404 });

  const patch: { images?: string[]; floor_plan_url?: null } = {};
  const removedUrls: string[] = [];
  if (hasImages) {
    const next = body!.images as string[];
    const current = new Set<string>(property.images);
    if (new Set(next).size !== next.length || next.some((url) => !current.has(url))) {
      return NextResponse.json({ error: "El orden solicitado no coincide con las imágenes actuales." }, { status: 400 });
    }
    patch.images = next;
    removedUrls.push(...property.images.filter((url: string) => !next.includes(url)));
  }
  if (clearPlan) {
    patch.floor_plan_url = null;
    if (property.floor_plan_url) removedUrls.push(property.floor_plan_url);
  }

  const { data: updated, error } = await supabase
    .from("items")
    .update(patch)
    .eq("id", itemId)
    .eq("tenant_id", tenant.id)
    .in("kind", ["product", "service", "property"])
    .select("id, images, floor_plan_url")
    .single();
  if (error) return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });

  if (removedUrls.length > 0) {
    const { data: media } = await supabase
      .from("media")
      .select("id, r2_key, thumb_key")
      .eq("tenant_id", tenant.id)
      .eq("item_id", itemId)
      .eq("status", "ready");
    const byUrl = new Map((media ?? []).map((m) => [mediaUrl(m.r2_key), m]));
    for (const url of removedUrls) {
      const match = byUrl.get(url);
      if (!match) continue; // URL legada de Storage: no hay fila en `media` que limpiar.
      const deleted = await deleteMedia(match.id, tenant.id);
      if (deleted.ok && r2Configured()) {
        await deleteObjects([deleted.r2_key, deleted.thumb_key]);
      } else if (!deleted.ok && deleted.code === "media_in_use") {
        // La cotización enviada y vigente que la referencia no debe perder su imagen: se deja el
        // medio, pero marcado para que el cron diario (T17) reintente borrarlo cuando venza.
        await markMediaDetached(match.id, tenant.id);
      }
    }
  }

  return NextResponse.json({ item: { id: updated.id, images: updated.images, floor_plan_url: updated.floor_plan_url } });
}

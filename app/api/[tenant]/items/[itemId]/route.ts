import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { CATALOG_COLUMNS, getAllowedKinds, itemErrorResponse } from "@/lib/catalog-admin";
import { parseItemInput } from "@/lib/item-input";
import { isUuid } from "@/lib/media";
import { deleteMedia, markMediaDetached } from "@/lib/media-store";
import { deleteObjects, r2Configured } from "@/lib/r2";

type Ctx = { params: Promise<{ tenant: string; itemId: string }> };

/** Edita campos de un producto/servicio (también ocultar/mostrar). Nunca toca `images` ni propiedades. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { tenant: slug, itemId } = await params;
  if (!isUuid(itemId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;
  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo no se pueden editar los ítems." }, { status: 403 });
  }

  const parsed = parseItemInput(await request.json().catch(() => null), {
    allowedKinds: await getAllowedKinds(supabase, tenant.id),
    partial: true,
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: "Nada que guardar." }, { status: 400 });

  const { data, error } = await supabase
    .from("items")
    .update(parsed.value)
    .eq("id", itemId)
    .eq("tenant_id", tenant.id)
    .in("kind", ["product", "service"])
    .select(CATALOG_COLUMNS)
    .maybeSingle();
  if (error) {
    const failure = itemErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  if (!data) return NextResponse.json({ error: "Ítem no encontrado." }, { status: 404 });
  return NextResponse.json({ item: data });
}

/**
 * Borra el ítem y todos sus medios (`media.item_id` tiene FK sin cascada, y una subida pendiente o
 * fallida también bloquearía el borrado): fila de `media` + objetos en R2, para que no sigan contando en la cuota.
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { tenant: slug, itemId } = await params;
  if (!isUuid(itemId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;
  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo no se pueden borrar los ítems." }, { status: 403 });
  }

  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("id", itemId)
    .eq("tenant_id", tenant.id)
    .in("kind", ["product", "service"])
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Ítem no encontrado." }, { status: 404 });

  const { data: media } = await supabase
    .from("media")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("item_id", itemId);
  for (const m of media ?? []) {
    const deleted = await deleteMedia(m.id, tenant.id);
    if (deleted.ok && r2Configured()) await deleteObjects([deleted.r2_key, deleted.thumb_key]);
    else if (!deleted.ok && deleted.code === "media_in_use") await markMediaDetached(m.id, tenant.id);
  }

  const { error } = await supabase.from("items").delete().eq("id", itemId).eq("tenant_id", tenant.id);
  if (error) return NextResponse.json({ error: "No se pudo borrar el ítem." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

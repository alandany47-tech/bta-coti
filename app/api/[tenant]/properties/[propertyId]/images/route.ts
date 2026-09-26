import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";
import { isUuid } from "@/lib/media";

/**
 * Reordena o quita imágenes de una propiedad. Solo acepta un subconjunto de las URLs actuales
 * (nunca URLs nuevas: esas las agrega el servidor al confirmar la subida a R2). Las imágenes de
 * R2 se borran con `DELETE /api/media/[id]`; esto cubre el orden, las imágenes legadas y quitar
 * un plano legado (`floor_plan_url: null`).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant: string; propertyId: string }> },
) {
  const { tenant: slug, propertyId } = await params;
  if (!isUuid(propertyId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const body = (await request.json().catch(() => null)) as { images?: unknown; floor_plan_url?: unknown } | null;
  const clearPlan = body?.floor_plan_url === null;
  const hasImages = Array.isArray(body?.images) && body.images.every((u) => typeof u === "string");
  if (!hasImages && !clearPlan) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const { data: property } = await supabase
    .from("items")
    .select("id, images")
    .eq("id", propertyId)
    .eq("tenant_id", tenant.id)
    .eq("kind", "property")
    .maybeSingle();
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada." }, { status: 404 });

  const patch: { images?: string[]; floor_plan_url?: null } = {};
  if (hasImages) {
    const next = body!.images as string[];
    const current = new Set<string>(property.images);
    if (new Set(next).size !== next.length || next.some((url) => !current.has(url))) {
      return NextResponse.json({ error: "El orden solicitado no coincide con las imágenes actuales." }, { status: 400 });
    }
    patch.images = next;
  }
  if (clearPlan) patch.floor_plan_url = null;

  const { data: updated, error } = await supabase
    .from("items")
    .update(patch)
    .eq("id", propertyId)
    .eq("tenant_id", tenant.id)
    .eq("kind", "property")
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) return NextResponse.json({ error: "No se pudo guardar el cambio." }, { status: 500 });

  return NextResponse.json({ property: itemToProperty(updated) });
}

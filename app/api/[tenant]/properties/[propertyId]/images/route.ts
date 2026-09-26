import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid } from "@/lib/media";

/**
 * Reordena o quita imágenes de una propiedad. Solo acepta un subconjunto de las URLs actuales
 * (nunca URLs nuevas: esas las agrega el servidor al confirmar la subida a R2). Las imágenes de
 * R2 se borran con `DELETE /api/media/[id]`; esto cubre el orden y las imágenes legadas.
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

  const body = (await request.json().catch(() => null)) as { images?: unknown } | null;
  if (!Array.isArray(body?.images) || !body.images.every((u) => typeof u === "string")) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const next = body.images as string[];

  const { data: property } = await supabase
    .from("properties")
    .select("id, images")
    .eq("id", propertyId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!property) return NextResponse.json({ error: "Propiedad no encontrada." }, { status: 404 });

  const current = new Set<string>(property.images);
  if (new Set(next).size !== next.length || next.some((url) => !current.has(url))) {
    return NextResponse.json({ error: "El orden solicitado no coincide con las imágenes actuales." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("properties")
    .update({ images: next })
    .eq("id", propertyId)
    .eq("tenant_id", tenant.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "No se pudo guardar el orden." }, { status: 500 });

  return NextResponse.json({ property: updated });
}

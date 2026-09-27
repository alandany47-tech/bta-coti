import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid, mediaUrl } from "@/lib/media";
import { deleteObjects, r2Configured } from "@/lib/r2";
import { deleteMedia, detachMediaUrl } from "@/lib/media-store";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slug = new URL(request.url).searchParams.get("tenant") ?? "";
  if (!isUuid(id) || !slug) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;

  if (access.tenant.is_demo) {
    return NextResponse.json({ error: "La demo no permite borrar archivos." }, { status: 403 });
  }

  const deleted = await deleteMedia(id, access.tenant.id);
  if (!deleted.ok) {
    if (deleted.code === "media_in_use") {
      return NextResponse.json(
        { error: "No se puede borrar: está en una cotización enviada y todavía vigente." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
  }

  await detachMediaUrl(access.tenant.id, mediaUrl(deleted.r2_key));
  if (r2Configured()) await deleteObjects([deleted.r2_key, deleted.thumb_key]);
  return new NextResponse(null, { status: 204 });
}

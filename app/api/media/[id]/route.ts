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

  const keys = await deleteMedia(id, access.tenant.id);
  if (!keys) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

  await detachMediaUrl(access.tenant.id, mediaUrl(keys.r2_key));
  if (r2Configured()) await deleteObjects([keys.r2_key, keys.thumb_key]);
  return new NextResponse(null, { status: 204 });
}

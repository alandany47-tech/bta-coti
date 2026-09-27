import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid, MEDIA_LIMITS, mediaUrl } from "@/lib/media";
import { deleteObjects, headObject, r2Configured } from "@/lib/r2";
import { attachMediaUrl, confirmMedia, deleteMedia, getPendingMedia, listItemMedia } from "@/lib/media-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tenant?: unknown; mediaId?: unknown } | null;
  if (typeof body?.tenant !== "string" || !isUuid(body.mediaId)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const access = await requireTenantAccess(body.tenant, "editor");
  if (access instanceof NextResponse) return access;
  const { tenant } = access;

  if (!r2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de archivos no está configurado." }, { status: 503 });
  }

  const media = await getPendingMedia(body.mediaId, tenant.id);
  if (!media) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });

  const discard = async () => {
    const deleted = await deleteMedia(media.id, tenant.id);
    if (deleted.ok) await deleteObjects([deleted.r2_key, deleted.thumb_key]);
  };

  // El tamaño que cuenta es el real en R2, no el que declaró el navegador.
  const [full, thumb] = await Promise.all([
    headObject(media.r2_key),
    media.thumb_key ? headObject(media.thumb_key) : Promise.resolve(null),
  ]);
  if (!full || (media.thumb_key && !thumb)) {
    return NextResponse.json({ error: "El archivo no llegó al almacenamiento. Vuelve a intentarlo." }, { status: 409 });
  }

  const maxFull = media.content_type === "application/pdf" ? MEDIA_LIMITS.planBytes : MEDIA_LIMITS.fullBytes;
  const valid =
    full.bytes > 0 &&
    full.bytes <= maxFull &&
    full.contentType === media.content_type &&
    (!thumb || (thumb.bytes > 0 && thumb.bytes <= MEDIA_LIMITS.thumbBytes && thumb.contentType === "image/webp"));
  if (!valid) {
    await discard();
    return NextResponse.json({ error: "El archivo no cumple el tamaño o el formato permitido." }, { status: 422 });
  }

  const confirmed = await confirmMedia(media.id, tenant.id, full.bytes, thumb?.bytes ?? 0);
  if (!confirmed.ok) {
    if (confirmed.code === "storage_quota_exceeded") {
      await discard();
      return NextResponse.json(
        { error: "Llegaste al límite de almacenamiento de tu plan.", code: confirmed.code },
        { status: 402 },
      );
    }
    return NextResponse.json({ error: "No se pudo confirmar el archivo." }, { status: 500 });
  }

  const url = mediaUrl(media.r2_key);
  const attached = media.item_id ? await attachMediaUrl(tenant.id, media.item_id, media.kind, url) : null;
  if (media.item_id && !attached) {
    await discard();
    return NextResponse.json({ error: "No se pudo ligar el archivo a la propiedad." }, { status: 500 });
  }

  // Un plano nuevo reemplaza al anterior: se borra el archivo viejo para no pagar almacenamiento,
  // salvo que una cotización enviada y vigente todavía lo referencie (media_in_use).
  if (media.kind === "plan" && media.item_id) {
    for (const old of await listItemMedia(tenant.id, media.item_id, "plan", media.id)) {
      const deleted = await deleteMedia(old.id, tenant.id);
      if (deleted.ok) await deleteObjects([deleted.r2_key, deleted.thumb_key]);
    }
  }

  return NextResponse.json({
    media: {
      id: media.id,
      url,
      thumbUrl: media.thumb_key ? mediaUrl(media.thumb_key) : null,
      bytes: full.bytes + (thumb?.bytes ?? 0),
    },
    property: attached,
  });
}

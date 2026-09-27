import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateSignRequest } from "@/lib/media";
import { presignPut, r2Configured, SIGN_EXPIRES_SECONDS } from "@/lib/r2";
import { reserveMedia } from "@/lib/media-store";

export const runtime = "nodejs";

const QUOTA_ERRORS = {
  storage_quota_exceeded: "Llegaste al límite de almacenamiento de tu plan. Libera espacio o cambia de plan.",
  item_media_limit: "Llegaste al límite de archivos para esta propiedad en tu plan.",
} as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateSignRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const access = await requireTenantAccess(input.tenant, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  if (tenant.is_demo) {
    return NextResponse.json({ error: "La demo no permite subir archivos." }, { status: 403 });
  }

  const limit = await checkRateLimit("media", tenant.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas subidas seguidas. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de archivos no está configurado." }, { status: 503 });
  }

  if (input.itemId) {
    const { data: item } = await supabase
      .from("items")
      .select("id")
      .eq("id", input.itemId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!item) return NextResponse.json({ error: "Propiedad no encontrada." }, { status: 404 });
  }

  const reserved = await reserveMedia({
    tenantId: tenant.id,
    itemId: input.itemId,
    kind: input.kind,
    contentType: input.contentType,
    bytes: input.bytes,
    thumbBytes: input.thumbBytes,
    width: input.width,
    height: input.height,
  });
  if (!reserved.ok) {
    if (reserved.code === "storage_quota_exceeded" || reserved.code === "item_media_limit") {
      return NextResponse.json({ error: QUOTA_ERRORS[reserved.code], code: reserved.code }, { status: 402 });
    }
    if (reserved.code === "tenant_not_operable") {
      return NextResponse.json({ error: "Tu cuenta no puede subir archivos ahora." }, { status: 403 });
    }
    return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 });
  }

  const { media } = reserved;
  const uploads = [
    { part: "full", url: await presignPut(media.r2_key, input.contentType, input.bytes), contentType: input.contentType },
  ];
  if (media.thumb_key) {
    uploads.push({
      part: "thumb",
      url: await presignPut(media.thumb_key, "image/webp", input.thumbBytes),
      contentType: "image/webp",
    });
  }

  return NextResponse.json({ mediaId: media.id, uploads, expiresIn: SIGN_EXPIRES_SECONDS });
}

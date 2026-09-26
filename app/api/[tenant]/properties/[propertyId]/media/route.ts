import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireTenantAccess } from "@/lib/auth/api";
import { MAX_PROPERTY_IMAGES, MAX_UPLOAD_BYTES } from "@/lib/uploads";

export const runtime = "nodejs";

type MediaKind = "image" | "floor_plan";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

async function resolveProperty(
  supabase: SupabaseClient,
  tenantId: string,
  propertyId: string,
) {
  const { data: property } = await supabase
    .from("properties")
    .select("id, images, floor_plan_url")
    .eq("id", propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!property) return { error: "Propiedad no encontrada." as const };

  return { property };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string; propertyId: string }> },
) {
  const { tenant: slug, propertyId } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const formData = await request.formData();
  const kind = formData.get("kind");
  const file = formData.get("file");

  if ((kind !== "image" && kind !== "floor_plan") || !(file instanceof File)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const mediaKind = kind as MediaKind;

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB." },
      { status: 400 },
    );
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "El archivo debe ser una imagen JPG, PNG, WebP, GIF o AVIF." },
      { status: 400 },
    );
  }

  const resolved = await resolveProperty(supabase, tenant.id, propertyId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }
  const { property } = resolved;

  if (mediaKind === "image" && property.images.length >= MAX_PROPERTY_IMAGES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_PROPERTY_IMAGES} imágenes por propiedad.` },
      { status: 400 },
    );
  }

  const extension = file.name.split(".").pop() || "jpg";
  const path = `${tenant.id}/${propertyId}/${mediaKind}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("property-media")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `No se pudo subir el archivo: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("property-media").getPublicUrl(path);

  const update =
    mediaKind === "image"
      ? { images: [...property.images, publicUrl] }
      : { floor_plan_url: publicUrl };

  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update(update)
    .eq("id", propertyId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `No se pudo actualizar la propiedad: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ property: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenant: string; propertyId: string }> },
) {
  const { tenant: slug, propertyId } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const kind = searchParams.get("kind");

  if (!url || (kind !== "image" && kind !== "floor_plan")) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const mediaKind = kind as MediaKind;

  const resolved = await resolveProperty(supabase, tenant.id, propertyId);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 404 });
  }
  const { property } = resolved;

  const update =
    mediaKind === "image"
      ? { images: property.images.filter((img: string) => img !== url) }
      : { floor_plan_url: null };

  const marker = "/property-media/";
  const markerIndex = url.indexOf(marker);
  const storagePath = markerIndex >= 0 ? url.slice(markerIndex + marker.length) : null;
  if (storagePath?.startsWith(`${tenant.id}/`)) {
    await supabase.storage.from("property-media").remove([storagePath]);
  }

  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update(update)
    .eq("id", propertyId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `No se pudo actualizar la propiedad: ${updateError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ property: updated });
}

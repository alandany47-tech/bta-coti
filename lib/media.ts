import { BRAND } from "@/lib/brand";

export const MEDIA_LIMITS = {
  fullBytes: 2 * 1024 * 1024,
  thumbBytes: 200 * 1024,
  planBytes: 10 * 1024 * 1024,
} as const;

export const MEDIA_KINDS = ["image", "render", "plan", "logo", "cover"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

export type SignRequest = {
  tenant: string;
  itemId: string | null;
  kind: MediaKind;
  contentType: "image/webp" | "application/pdf";
  bytes: number;
  thumbBytes: number;
  width: number | null;
  height: number | null;
};

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function validateSignRequest(
  body: unknown,
): { ok: true; value: SignRequest } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind as MediaKind;
  if (typeof b.tenant !== "string" || !b.tenant) return { ok: false, error: "Falta el tenant." };
  if (!MEDIA_KINDS.includes(kind)) return { ok: false, error: "Tipo de medio inválido." };

  const isPlan = kind === "plan";
  const contentType = isPlan ? "application/pdf" : "image/webp";
  if (b.contentType !== contentType) {
    return { ok: false, error: isPlan ? "El plano debe ser un PDF." : "La imagen debe ser WebP." };
  }

  const bytes = positiveInt(b.bytes);
  const max = isPlan ? MEDIA_LIMITS.planBytes : MEDIA_LIMITS.fullBytes;
  if (!bytes) return { ok: false, error: "Indica el tamaño del archivo." };
  if (bytes > max) return { ok: false, error: `El archivo supera el máximo de ${max / 1024 / 1024} MB.` };

  const rawThumb = b.thumbBytes ?? 0;
  const thumbBytes = rawThumb === 0 ? 0 : positiveInt(rawThumb);
  if (thumbBytes === null) return { ok: false, error: "Tamaño de miniatura inválido." };
  if (isPlan && thumbBytes > 0) return { ok: false, error: "Los planos no llevan miniatura." };
  if (thumbBytes > MEDIA_LIMITS.thumbBytes) return { ok: false, error: "La miniatura supera 200 KB." };

  const needsItem = kind === "image" || kind === "render" || kind === "plan";
  const itemId = b.itemId ?? null;
  if (needsItem && !isUuid(itemId)) return { ok: false, error: "Falta la propiedad del medio." };
  if (!needsItem && itemId !== null) return { ok: false, error: "Este tipo de medio no va ligado a una propiedad." };

  const width = b.width == null ? null : positiveInt(b.width);
  const height = b.height == null ? null : positiveInt(b.height);
  if ((b.width != null && (!width || width > 10000)) || (b.height != null && (!height || height > 10000))) {
    return { ok: false, error: "Dimensiones inválidas." };
  }

  return {
    ok: true,
    value: { tenant: b.tenant, itemId: itemId as string | null, kind, contentType, bytes, thumbBytes, width, height },
  };
}

/** URL pública (CDN) de una llave de R2. */
export function mediaUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? `https://media.${BRAND.domain}`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

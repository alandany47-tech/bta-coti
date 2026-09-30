import { prepareImage } from "@/lib/image-client";

export type UploadKind = "image" | "render" | "plan" | "logo";

export type UploadedMedia = {
  media: { id: string; url: string; thumbUrl: string | null; bytes: number };
  property: { images: string[]; floor_plan_url: string | null } | null;
};

export type UploadResult = ({ ok: true } & UploadedMedia) | { ok: false; error: string };

export type UploadStage = "compressing" | "uploading" | "confirming";

type SignResponse = {
  mediaId: string;
  uploads: { part: "full" | "thumb"; url: string; contentType: string }[];
};

function put(url: string, blob: Blob, contentType: string, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("No se pudo subir el archivo.")));
    xhr.onerror = () => reject(new Error("Se perdió la conexión al subir el archivo."));
    xhr.send(blob);
  });
}

async function json<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

/**
 * Sube un archivo a R2: convierte a WebP (miniatura incluida), pide URLs firmadas, sube con
 * progreso (0–1) y confirma. El servidor mide el tamaño real y aplica la cuota del plan.
 */
export async function uploadMedia(input: {
  tenant: string;
  itemId: string | null;
  kind: UploadKind;
  file: File;
  onStage?: (stage: UploadStage) => void;
  onProgress?: (fraction: number) => void;
}): Promise<UploadResult> {
  const { tenant, itemId, kind, file, onStage, onProgress } = input;
  try {
    onStage?.("compressing");
    const isPdf = kind === "plan" && file.type === "application/pdf";
    const parts: { part: "full" | "thumb"; blob: Blob; contentType: string }[] = [];
    let width: number | undefined;
    let height: number | undefined;
    if (isPdf) {
      parts.push({ part: "full", blob: file, contentType: "application/pdf" });
    } else {
      const { full, thumb } = await prepareImage(file);
      width = full.width;
      height = full.height;
      parts.push({ part: "full", blob: full.blob, contentType: "image/webp" });
      if (kind !== "plan") parts.push({ part: "thumb", blob: thumb.blob, contentType: "image/webp" });
    }

    const sign = await fetch("/api/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant,
        itemId,
        kind,
        contentType: parts[0].contentType,
        bytes: parts[0].blob.size,
        thumbBytes: parts.find((p) => p.part === "thumb")?.blob.size ?? 0,
        width,
        height,
      }),
    });
    const signed = await json<SignResponse>(sign);
    if (!sign.ok) return { ok: false, error: signed.error ?? "No se pudo preparar la subida." };

    onStage?.("uploading");
    const total = parts.reduce((sum, p) => sum + p.blob.size, 0);
    const loaded: Record<string, number> = {};
    for (const upload of signed.uploads) {
      const part = parts.find((p) => p.part === upload.part);
      if (!part) continue;
      await put(upload.url, part.blob, part.contentType, (bytes) => {
        loaded[upload.part] = bytes;
        onProgress?.(Math.min(1, Object.values(loaded).reduce((a, b) => a + b, 0) / total));
      });
      loaded[upload.part] = part.blob.size;
    }

    onStage?.("confirming");
    const confirm = await fetch("/api/media/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant, mediaId: signed.mediaId }),
    });
    const confirmed = await json<UploadedMedia>(confirm);
    if (!confirm.ok) return { ok: false, error: confirmed.error ?? "No se pudo confirmar el archivo." };
    return { ok: true, media: confirmed.media, property: confirmed.property };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo subir el archivo." };
  }
}

export async function deleteMediaById(tenant: string, mediaId: string): Promise<string | null> {
  const response = await fetch(`/api/media/${mediaId}?tenant=${encodeURIComponent(tenant)}`, { method: "DELETE" });
  return response.ok ? null : ((await json<object>(response)).error ?? "No se pudo eliminar el archivo.");
}

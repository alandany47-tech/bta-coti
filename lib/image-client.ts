/** Conversión de imágenes a WebP en el navegador (T13). Nunca se suben originales. */

export const FULL_MAX_EDGE = 2000;
export const THUMB_MAX_EDGE = 480;
export const FULL_TARGET_BYTES = 380 * 1024;
export const THUMB_TARGET_BYTES = 60 * 1024;
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type WebpResult = { blob: Blob; width: number; height: number };

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === "image/webp") resolve(blob);
        else reject(new Error("Tu navegador no puede convertir imágenes a WebP. Usa Chrome, Edge o Firefox."));
      },
      "image/webp",
      quality,
    );
  });
}

function draw(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * Redimensiona y comprime a WebP hasta quedar bajo `targetBytes`: baja la calidad y, si aún no
 * alcanza, reduce el lado largo un 15 % (mínimo 1000 px, o el máximo pedido si es menor).
 */
export async function toWebp(
  bitmap: ImageBitmap,
  maxEdge: number,
  targetBytes: number,
  startQuality = 0.82,
): Promise<WebpResult> {
  const floor = Math.min(maxEdge, 1000);
  let edge = maxEdge;
  let best: WebpResult | null = null;
  for (;;) {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, edge);
    const canvas = draw(bitmap, width, height);
    for (let quality = startQuality; quality >= 0.5; quality -= 0.08) {
      const blob = await encode(canvas, quality);
      best = { blob, width, height };
      if (blob.size <= targetBytes) return best;
    }
    if (edge <= floor) return best!;
    edge = Math.max(floor, Math.round(edge * 0.85));
  }
}

export async function prepareImage(file: File): Promise<{ full: WebpResult; thumb: WebpResult }> {
  if (!file.type.startsWith("image/")) throw new Error(`"${file.name}" no es una imagen.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`"${file.name}" pesa más de 30 MB.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`No se pudo leer "${file.name}". Prueba con un JPG, PNG o WebP.`);
  }
  try {
    const full = await toWebp(bitmap, FULL_MAX_EDGE, FULL_TARGET_BYTES);
    const thumb = await toWebp(bitmap, THUMB_MAX_EDGE, THUMB_TARGET_BYTES, 0.72);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
}

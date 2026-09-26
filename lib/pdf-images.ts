import "server-only";
import sharp from "sharp";
import { mediaUrl } from "@/lib/media";
import type { Property } from "@/lib/types";

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * react-pdf solo lee JPEG y PNG, y los medios nuevos son WebP en R2. Convierte a JPEG (data URI)
 * únicamente las URLs de la carpeta del propio tenant en el CDN; el resto (medios legados) pasa
 * igual y nunca se descarga una URL arbitraria en el servidor. Los planos en PDF no se incrustan.
 */
export async function prepareForPdf(property: Property, tenantId: string): Promise<Property> {
  const prefix = mediaUrl(`t/${tenantId}/`);

  async function convert(url: string): Promise<string | null> {
    if (url.toLowerCase().endsWith(".pdf") && url.startsWith(prefix)) return null;
    if (!url.startsWith(prefix) || !url.toLowerCase().endsWith(".webp")) return url;
    try {
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!response.ok || buffer.length > MAX_BYTES) return null;
      const jpeg = await sharp(buffer).jpeg({ quality: 82 }).toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    } catch (error) {
      console.error("prepareForPdf falló", url, error);
      return null;
    }
  }

  const [images, plan] = await Promise.all([
    Promise.all(property.images.slice(0, 9).map(convert)),
    property.floor_plan_url ? convert(property.floor_plan_url) : Promise.resolve(null),
  ]);

  return { ...property, images: images.filter((u): u is string => u !== null), floor_plan_url: plan };
}

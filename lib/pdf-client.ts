import { BRAND } from "@/lib/brand";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import { getQuoteTemplate, safeBrandColor } from "@/lib/quote-templates";
import { buildQuoteViewModel } from "@/lib/quote-view-model";

/** Generación del PDF en el navegador (T15): react-pdf solo lee JPEG/PNG, así que las imágenes se re-codifican. */
const MAX_EDGE = 1400;

async function toJpegDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

export async function buildQuotePdf(snapshot: QuoteSnapshot): Promise<Blob> {
  const [{ pdf }, { QuoteDocument }] = await Promise.all([import("@react-pdf/renderer"), import("@/pdf/QuoteDocument")]);
  const model = buildQuoteViewModel(snapshot, BRAND.name);

  const [images, floorPlan, logo] = await Promise.all([
    Promise.all(model.images.map(toJpegDataUrl)),
    model.floorPlanUrl ? toJpegDataUrl(model.floorPlanUrl) : Promise.resolve(null),
    snapshot.tenantLogoUrl ? toJpegDataUrl(snapshot.tenantLogoUrl) : Promise.resolve(null),
  ]);

  const document = QuoteDocument({
    model,
    template: getQuoteTemplate(snapshot.templateCode),
    brandColor: safeBrandColor(snapshot.brandColor),
    logo,
    images: images.filter((u): u is string => u !== null),
    floorPlan,
  });
  return pdf(document).toBlob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

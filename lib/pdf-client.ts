import type { QuoteSnapshot } from "@/lib/quote-snapshot";

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
  const { property } = snapshot;
  const plan = property.floor_plan_url && !property.floor_plan_url.toLowerCase().endsWith(".pdf") ? property.floor_plan_url : null;

  const [images, floorPlan, logo] = await Promise.all([
    Promise.all(property.images.slice(0, 9).map(toJpegDataUrl)),
    plan ? toJpegDataUrl(plan) : Promise.resolve(null),
    snapshot.tenantLogoUrl ? toJpegDataUrl(snapshot.tenantLogoUrl) : Promise.resolve(null),
  ]);

  const document = QuoteDocument({
    tenantName: snapshot.tenantName,
    tenantLogoUrl: logo,
    brandColor: snapshot.brandColor ?? undefined,
    advisorName: snapshot.advisorName,
    quoteId: snapshot.quoteId,
    quoteNumber: snapshot.number,
    clientName: snapshot.clientName,
    clientPhone: snapshot.clientPhone,
    property: { ...property, images: images.filter((u): u is string => u !== null), floor_plan_url: floorPlan },
    breakdown: snapshot.breakdown,
    installmentsCount: snapshot.installmentsCount,
    notes: snapshot.notes,
    createdAt: snapshot.createdAt,
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

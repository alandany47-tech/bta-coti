import { formatCurrency } from "@/lib/utils";
import type { PricingBreakdown } from "@/lib/pricing";

/** Deja solo dígitos: wa.me exige el número en formato E.164 sin "+" ni espacios. */
function sanitizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

type BuildWhatsAppMessageArgs = {
  tenantName: string;
  clientName: string;
  propertyTitle: string;
  propertyUnitNumber: string;
  breakdown: PricingBreakdown;
  installmentsCount: number;
  pdfUrl: string;
};

export function buildWhatsAppMessage({
  tenantName,
  clientName,
  propertyTitle,
  propertyUnitNumber,
  breakdown,
  installmentsCount,
  pdfUrl,
}: BuildWhatsAppMessageArgs) {
  const lines = [
    `Hola ${clientName}, aquí el desglose ejecutivo de tu cotización con *${tenantName}*:`,
    "",
    `🏠 ${propertyTitle} · Unidad ${propertyUnitNumber}`,
    "",
    `Precio: ${formatCurrency(breakdown.effectivePrice)}`,
    `Enganche: ${formatCurrency(breakdown.downPaymentAmount)}`,
    `Mensualidad: ${formatCurrency(breakdown.monthlyPaymentAmount)} x ${installmentsCount} meses`,
    breakdown.finalPaymentAmount > 0.009
      ? `Saldo a escrituración: ${formatCurrency(breakdown.finalPaymentAmount)}`
      : null,
    "",
    `Descarga tu cotización en PDF: ${pdfUrl}`,
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

type BuildWhatsAppUrlArgs = BuildWhatsAppMessageArgs & {
  clientPhone: string;
};

/** Construye la URL wa.me con el mensaje ya codificado. */
export function buildWhatsAppUrl({ clientPhone, ...rest }: BuildWhatsAppUrlArgs) {
  const phone = sanitizePhone(clientPhone);
  const message = buildWhatsAppMessage(rest);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

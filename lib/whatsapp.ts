import { formatCurrency } from "@/lib/utils";
import type { QuoteItem } from "@/lib/types";

/** Deja solo dígitos: wa.me exige el número en formato E.164 sin "+" ni espacios. */
function sanitizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

type BuildWhatsAppMessageArgs = {
  tenantName: string;
  clientName: string;
  items: QuoteItem[];
  totalAmount: number;
  pdfUrl: string;
};

export function buildWhatsAppMessage({
  tenantName,
  clientName,
  items,
  totalAmount,
  pdfUrl,
}: BuildWhatsAppMessageArgs) {
  const lines = [
    `Hola ${clientName}, aquí tu cotización de *${tenantName}*:`,
    "",
    ...items.map(
      (item) =>
        `• ${item.quantity} x ${item.name} — ${formatCurrency(item.unit_price * item.quantity)}`,
    ),
    "",
    `*Total: ${formatCurrency(totalAmount)}*`,
    "",
    `Descarga tu cotización en PDF: ${pdfUrl}`,
  ];

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

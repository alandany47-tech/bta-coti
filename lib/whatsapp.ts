import { normalizeWhatsapp } from "@/lib/catalog";

/**
 * wa.me exige el número en formato E.164 sin "+" ni espacios y CON código de país. Un cliente
 * capturado a 10 dígitos ("55 1234 5678") se toma como mexicano (52): sin ese prefijo WhatsApp
 * leería "55" como el código de Brasil y el mensaje iría a otro número. Lo que no cuadra con un
 * número válido (menos de 10 o más de 15 dígitos) se manda solo con los dígitos que tenga.
 */
export function whatsappDigits(phone: string): string {
  return normalizeWhatsapp(phone) ?? phone.replace(/\D/g, "");
}

/** URL wa.me con un mensaje ya resuelto (ver `lib/message-templates.ts` → `renderMessage`). */
export function buildWhatsAppUrl(clientPhone: string, message: string) {
  return `https://wa.me/${whatsappDigits(clientPhone)}?text=${encodeURIComponent(message)}`;
}

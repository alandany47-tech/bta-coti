/** Deja solo dígitos: wa.me exige el número en formato E.164 sin "+" ni espacios. */
function sanitizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

/** URL wa.me con un mensaje ya resuelto (ver `lib/message-templates.ts` → `renderMessage`). */
export function buildWhatsAppUrl(clientPhone: string, message: string) {
  const phone = sanitizePhone(clientPhone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

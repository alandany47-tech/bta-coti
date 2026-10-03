import "server-only";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { BRAND } from "@/lib/brand";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Envío por la API REST de Resend (sin SDK: es una sola llamada). `idempotencyKey` hace que un
 * reintento del mismo correo no llegue dos veces aunque nuestro registro (`email_log`) falle.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  element: ReactElement;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY no configurada" };

  const [html, text] = await Promise.all([render(input.element), render(input.element, { plainText: true })]);
  const from = process.env.EMAIL_FROM || `${BRAND.name} <hola@${BRAND.domain}>`;
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;

  try {
    const response = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html, text, reply_to: replyTo }),
    });
    if (!response.ok) return { ok: false, error: `Resend ${response.status}: ${(await response.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "fallo de red" };
  }
}

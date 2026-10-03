import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { buildEmail, type EmailData, type EmailKind } from "@/emails/templates";
import { EXPIRED_EMAIL_WINDOW_MS, REMINDER_LOOKAHEAD_MS, trialReminderKind } from "@/lib/email/schedule";

export type NotifyResult = "sent" | "duplicate" | "skipped" | "failed";

/** Correo del dueño del tenant (el único que recibe los avisos de cuenta). */
async function ownerEmail(tenantId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { data: user } = await admin.auth.admin.getUserById(data.user_id);
  return user?.user?.email ?? null;
}

/**
 * Manda un correo de cuenta al dueño, una sola vez por (tenant, tipo, ref): reclama la fila de
 * `email_log` antes de enviar y la suelta si el envío falla, para que el siguiente cron lo reintente.
 * Nunca lanza: un correo que falla no debe tumbar el cron ni el webhook de Stripe.
 */
export async function notifyTenant(input: { tenantId: string; kind: EmailKind; data: EmailData; ref?: string }): Promise<NotifyResult> {
  if (!emailConfigured()) return "skipped";
  const ref = input.ref ?? "";
  const admin = createServiceRoleClient();
  try {
    const to = await ownerEmail(input.tenantId);
    if (!to) return "skipped";

    const { data: claimed, error } = await admin
      .from("email_log")
      .insert({ tenant_id: input.tenantId, kind: input.kind, ref, sent_to: to })
      .select("id")
      .maybeSingle();
    if (error) return error.code === "23505" ? "duplicate" : "failed";
    if (!claimed) return "failed";

    const { subject, element } = buildEmail(input.kind, input.data);
    const result = await sendEmail({ to, subject, element, idempotencyKey: `${input.tenantId}:${input.kind}:${ref}` });
    if (!result.ok) {
      console.error(`correo ${input.kind} no enviado (${input.data.slug}):`, result.error);
      await admin.from("email_log").delete().eq("id", claimed.id);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error(`correo ${input.kind} falló (${input.data.slug}):`, error);
    return "failed";
  }
}

/** Avisos de la prueba para el cron diario: día 5, día 7 y vencida. Corre DESPUÉS de `expireTrials()`. */
export async function sendTrialEmails(now = new Date()): Promise<Record<NotifyResult, number>> {
  const admin = createServiceRoleClient();
  const counts: Record<NotifyResult, number> = { sent: 0, duplicate: 0, skipped: 0, failed: 0 };
  if (!emailConfigured()) return counts;
  const tally = (result: NotifyResult) => void (counts[result] += 1);

  const { data: ending } = await admin
    .from("tenants")
    .select("id, slug, name, trial_ends_at")
    .eq("status", "trialing")
    .eq("is_demo", false)
    .is("stripe_subscription_id", null)
    .gt("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", new Date(now.getTime() + REMINDER_LOOKAHEAD_MS).toISOString());
  for (const t of ending ?? []) {
    const kind = trialReminderKind(new Date(t.trial_ends_at as string), now);
    if (!kind) continue;
    tally(await notifyTenant({ tenantId: t.id, kind, data: { tenantName: t.name, slug: t.slug, trialEndsAt: t.trial_ends_at } }));
  }

  const { data: expired } = await admin
    .from("tenants")
    .select("id, slug, name, trial_ends_at")
    .eq("status", "suspended")
    .eq("status_reason", "trial_expired")
    .eq("is_demo", false)
    .gte("status_changed_at", new Date(now.getTime() - EXPIRED_EMAIL_WINDOW_MS).toISOString());
  for (const t of expired ?? []) {
    tally(await notifyTenant({ tenantId: t.id, kind: "trial_expired", data: { tenantName: t.name, slug: t.slug, trialEndsAt: t.trial_ends_at } }));
  }
  return counts;
}

async function tenantData(tenantId: string): Promise<EmailData | null> {
  const { data } = await createServiceRoleClient().from("tenants").select("slug, name, trial_ends_at").eq("id", tenantId).maybeSingle();
  return data ? { tenantName: data.name, slug: data.slug, trialEndsAt: data.trial_ends_at } : null;
}

/** Bienvenida al provisionar un registro propio (el alta desde el admin ya manda su invitación). */
export async function sendWelcomeEmail(tenantSlug: string): Promise<NotifyResult> {
  const { data } = await createServiceRoleClient().from("tenants").select("id").eq("slug", tenantSlug).maybeSingle();
  if (!data) return "skipped";
  const info = await tenantData(data.id);
  return info ? notifyTenant({ tenantId: data.id, kind: "welcome", data: info }) : "skipped";
}

/** Falla de cobro: un correo por factura (Stripe reintenta el cobro y manda el webhook varias veces). */
export async function sendPaymentFailedEmail(tenantId: string, invoiceId: string): Promise<NotifyResult> {
  const info = await tenantData(tenantId);
  return info ? notifyTenant({ tenantId, kind: "payment_failed", data: info, ref: invoiceId }) : "skipped";
}

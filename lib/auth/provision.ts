import "server-only";
import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parsePendingTenant, type PendingTenant } from "@/lib/auth/register-schema";

export type ProvisionResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "slug_taken" | "trial_used" | "email_disposable" | "invalid" | "error" };

const TRIAL_DAYS = 7;

const KNOWN_REASONS = ["slug_taken", "trial_used", "email_disposable"] as const;

export async function provisionTenant(userId: string, pending: PendingTenant): Promise<ProvisionResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("provision_tenant", {
    p_owner: userId,
    p_name: pending.name,
    p_slug: pending.slug,
    p_plan_code: pending.plan_code,
    p_status: "trialing",
    p_trial_days: TRIAL_DAYS,
    p_source: "self_signup",
    p_billing_mode: "stripe",
  });

  if (error) {
    const known = KNOWN_REASONS.find((reason) => error.message.includes(reason));
    if (known) {
      if (known !== "slug_taken") await clearPending(userId);
      return { ok: false, reason: known };
    }
    if (error.message.includes("slug_invalid")) return { ok: false, reason: "slug_taken" };
    console.error("provision_tenant falló", error.message);
    return { ok: false, reason: "error" };
  }

  await clearPending(userId);
  return { ok: true, slug: pending.slug };
}

/** Provisiona el tenant guardado en `user_metadata.pending_tenant`; null si no hay ninguno. */
export async function provisionPendingTenant(user: User): Promise<ProvisionResult | null> {
  const raw = user.user_metadata?.pending_tenant;
  if (raw === undefined || raw === null) return null;
  const pending = parsePendingTenant(raw);
  if (!pending) {
    await clearPending(user.id);
    return { ok: false, reason: "invalid" };
  }
  return provisionTenant(user.id, pending);
}

async function clearPending(userId: string) {
  await createServiceRoleClient().auth.admin.updateUserById(userId, {
    user_metadata: { pending_tenant: null },
  });
}

import "server-only";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tenantTag } from "@/lib/tenants";

/** Vence pruebas (T17): trialing + trial_ends_at pasado + sin suscripción → suspended. */
export async function expireTrials(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("expire_trials");
  if (error) throw error;
  const slugs = data ?? [];
  for (const slug of slugs) revalidateTag(tenantTag(slug), { expire: 0 });
  return slugs;
}

/**
 * Suspende cuentas con más de 7 días en `past_due` (T20): Stripe no manda un webhook para esto
 * (no existe `invoice.overdue`), así que se deriva de `tenants.status_changed_at` en el cron diario.
 */
export async function expirePastDue(): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("expire_past_due");
  if (error) throw error;
  const slugs = data ?? [];
  for (const slug of slugs) revalidateTag(tenantTag(slug), { expire: 0 });
  return slugs;
}

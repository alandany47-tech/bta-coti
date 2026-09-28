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

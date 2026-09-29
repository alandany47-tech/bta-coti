import "server-only";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tenantTag } from "@/lib/tenants";
import type { TenantStatus } from "@/lib/types";

export const TENANT_STATUSES: TenantStatus[] = ["trialing", "active", "past_due", "suspended", "canceled"];

export const STATUSES_REQUIRING_REASON: TenantStatus[] = ["suspended", "canceled"];

export type StatusResult = { ok: true; slug: string } | { ok: false; code: "reason_required" | "not_found" | "error" };

/**
 * Único camino para cambiar el estado de un tenant: actualiza, audita e invalida el caché.
 * `actorId` es `null` para cambios automáticos (cron, webhooks de Stripe) — igual que ya hacían
 * `expire_trials`/`expire_past_due` en SQL.
 */
export async function setTenantStatus(
  tenantId: string,
  status: TenantStatus,
  reason: string | null,
  actorId: string | null,
): Promise<StatusResult> {
  const { data, error } = await createServiceRoleClient().rpc("set_tenant_status", {
    p_tenant: tenantId,
    p_status: status,
    p_reason: reason ?? "",
    p_actor: actorId,
  });
  if (error) {
    if (error.message.includes("reason_required")) return { ok: false, code: "reason_required" };
    if (error.message.includes("tenant_not_found")) return { ok: false, code: "not_found" };
    console.error("set_tenant_status falló", error.message);
    return { ok: false, code: "error" };
  }
  revalidateTag(tenantTag(data), { expire: 0 });
  return { ok: true, slug: data };
}

export async function logAudit(
  action: string,
  tenantId: string | null,
  actorId: string | null,
  payload: Record<string, unknown> = {},
) {
  const { error } = await createServiceRoleClient()
    .from("audit_log")
    .insert({ action, tenant_id: tenantId, actor_id: actorId, payload: payload as never });
  if (error) console.error("audit_log falló", error.message);
}

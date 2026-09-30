import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emailsByIds } from "@/lib/admin-users";

export type AuditLogRow = {
  id: string;
  action: string;
  createdAt: string;
  payload: Record<string, unknown>;
  tenant: { id: string; name: string; slug: string } | null;
  actorEmail: string | null;
};

type Joined = {
  id: string;
  action: string;
  created_at: string;
  payload: Record<string, unknown>;
  tenant_id: string | null;
  actor_id: string | null;
  tenants: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * Auditoría paginada (T24b): sin `tenantId` es la vista global (`/admin/auditoria`); con
 * `tenantId` es el historial de un tenant en su página de detalle. `q` busca en la acción o en el
 * nombre/subdominio del tenant.
 */
export async function listAuditLogForAdmin(filters: {
  tenantId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AuditLogRow[]; total: number; page: number; pageSize: number }> {
  const supabase = createServiceRoleClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audit_log")
    .select("id, action, created_at, payload, tenant_id, actor_id, tenants(id, name, slug)", { count: "exact" });

  if (filters.tenantId) query = query.eq("tenant_id", filters.tenantId);

  const q = filters.q?.trim().replace(/[%_]/g, "");
  if (q) {
    const { data: matchingTenants } = await supabase
      .from("tenants")
      .select("id")
      .or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
    const tenantIds = (matchingTenants ?? []).map((t) => (t as { id: string }).id);
    if (tenantIds.length > 0) {
      query = query.or(`action.ilike.%${q}%,tenant_id.in.(${tenantIds.join(",")})`);
    } else {
      query = query.ilike("action", `%${q}%`);
    }
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error(`No se pudo cargar la auditoría: ${error.message}`);

  const rows = (data ?? []) as unknown as Joined[];
  const actorIds = rows.map((r) => r.actor_id).filter((id): id is string => id !== null);
  const emails = await emailsByIds(actorIds);

  return {
    rows: rows.map((r) => {
      const tenant = one(r.tenants);
      return {
        id: r.id,
        action: r.action,
        createdAt: r.created_at,
        payload: r.payload ?? {},
        tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
        actorEmail: r.actor_id ? emails.get(r.actor_id) ?? null : null,
      };
    }),
    total: count ?? 0,
    page,
    pageSize,
  };
}

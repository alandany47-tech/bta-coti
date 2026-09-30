import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emailsByIds } from "@/lib/admin-users";
import type { AdminTenantRow, TenantStatus } from "@/lib/types";

const SELECT = "*, plans(name), usage(items_count, quotes_this_month, storage_bytes)";

type Joined = Omit<AdminTenantRow, "plan_name" | "items_count" | "quotes_month" | "storage_bytes" | "storage_limit" | "current_period_end" | "cancel_at_period_end"> & {
  plans: { name: string } | { name: string }[] | null;
  usage: { items_count: number; quotes_this_month: number; storage_bytes: number } | { items_count: number; quotes_this_month: number; storage_bytes: number }[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toRow({ plans, usage, ...tenant }: Joined): AdminTenantRow {
  return {
    ...tenant,
    plan_name: one(plans)?.name ?? "—",
    items_count: one(usage)?.items_count ?? 0,
    quotes_month: one(usage)?.quotes_this_month ?? 0,
    storage_bytes: one(usage)?.storage_bytes ?? 0,
    // Límite y periodo de cobro: solo `listTenantsForAdminPaged` (lista de Clientes) los trae —
    // aquí (usado por las rutas /api/admin/tenants*) no hacía falta antes de T24 y no se agrega
    // para no ampliar esas respuestas sin necesidad.
    storage_limit: null,
    current_period_end: null,
    cancel_at_period_end: null,
  };
}

/**
 * Tenants con su plan y los conteos de `usage`. Vía service role: quien llame
 * a esto YA debe haber validado getAdminUser(); aquí no hay otra barrera.
 */
/** Clientes reales: los tenants de demo se excluyen (docs/DEMO.md §1: fuera de los KPIs del admin). */
export async function listTenantsForAdmin(): Promise<AdminTenantRow[]> {
  const { data, error } = await createServiceRoleClient()
    .from("tenants")
    .select(SELECT)
    .eq("is_demo", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los tenants: ${error.message}`);
  return ((data ?? []) as unknown as Joined[]).map(toRow);
}

export type AdminDemoTenantRow = { id: string; name: string; slug: string; status: string; plan_name: string };

export async function listDemoTenantsForAdmin(): Promise<AdminDemoTenantRow[]> {
  const { data, error } = await createServiceRoleClient()
    .from("tenants")
    .select("id, name, slug, status, plans(name)")
    .eq("is_demo", true)
    .order("slug", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los tenants de demo: ${error.message}`);
  return ((data ?? []) as unknown as { id: string; name: string; slug: string; status: string; plans: { name: string } | { name: string }[] | null }[]).map(
    (row) => ({ id: row.id, name: row.name, slug: row.slug, status: row.status, plan_name: one(row.plans)?.name ?? "—" }),
  );
}

export type TenantMember = { userId: string; role: "owner" | "editor" | "viewer"; email: string | null };

/** Dueño + miembros de un tenant, con su email resuelto (Cliente-detalle, T24b). */
export async function getTenantMembers(tenantId: string): Promise<TenantMember[]> {
  const { data } = await createServiceRoleClient()
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .order("role", { ascending: true });
  const rows = (data ?? []) as { user_id: string; role: TenantMember["role"] }[];
  const emails = await emailsByIds(rows.map((r) => r.user_id));
  return rows.map((r) => ({ userId: r.user_id, role: r.role, email: emails.get(r.user_id) ?? null }));
}

/** Código del plan (para clonar un tenant de demo con el mismo plan al aprovisionar el prospecto). */
export async function getTenantPlanCode(tenantId: string): Promise<string | null> {
  const { data } = await createServiceRoleClient()
    .from("tenants")
    .select("plans(code)")
    .eq("id", tenantId)
    .maybeSingle();
  return one((data as unknown as { plans: { code: string } | { code: string }[] | null } | null)?.plans ?? null)?.code ?? null;
}

export async function getTenantForAdmin(id: string): Promise<AdminTenantRow | null> {
  const { data, error } = await createServiceRoleClient()
    .from("tenants")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toRow(data as unknown as Joined);
}

const PAGED_SELECT =
  "*, plans(name, limits), usage(items_count, quotes_this_month, storage_bytes), subscriptions(current_period_end, cancel_at_period_end)";

type PagedJoined = Omit<Joined, "plans"> & {
  plans: { name: string; limits: Record<string, number | undefined> | null } | { name: string; limits: Record<string, number | undefined> | null }[] | null;
  subscriptions:
    | { current_period_end: string | null; cancel_at_period_end: boolean | null }
    | { current_period_end: string | null; cancel_at_period_end: boolean | null }[]
    | null;
};

export type AdminTenantFilters = {
  search?: string;
  status?: TenantStatus;
  planCode?: string;
  origin?: "self_signup" | "admin" | "demo_clone";
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Lista paginada de Clientes (Panel Admin, T24): búsqueda por nombre/subdominio, filtros por
 * estado/plan/origen y `.range()` server-side — a diferencia de `listTenantsForAdmin`, que trae
 * TODO y no escala (docs/ADMIN-PANEL.md §1.5).
 */
export async function listTenantsForAdminPaged(
  filters: AdminTenantFilters = {},
): Promise<{ rows: AdminTenantRow[]; total: number; page: number; pageSize: number }> {
  const supabase = createServiceRoleClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let planId: string | null = null;
  if (filters.planCode) {
    const { data: plan } = await supabase.from("plans").select("id").eq("code", filters.planCode).maybeSingle();
    planId = plan?.id ?? null;
  }

  let query = supabase.from("tenants").select(PAGED_SELECT, { count: "exact" }).eq("is_demo", false);

  const search = filters.search?.trim().replace(/[%_]/g, "");
  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.origin) query = query.eq("source", filters.origin);
  if (planId) query = query.eq("plan_id", planId);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error(`No se pudieron cargar los tenants: ${error.message}`);

  // Mismo criterio que effective_limit() (0010_media.sql): el tope del plan, acotado por el de
  // "trial" mientras el tenant está en prueba. Se trae una sola vez para toda la página.
  const { data: trialPlan } = await supabase.from("plans").select("limits").eq("code", "trial").maybeSingle();
  const trialStorageLimit = (trialPlan?.limits as Record<string, number | undefined> | null)?.storage_bytes ?? null;

  const rows = ((data ?? []) as unknown as PagedJoined[]).map((row) => {
    const { plans, usage, subscriptions, ...tenant } = row;
    const plan = one(plans);
    const usageRow = one(usage);
    const sub = one(subscriptions);
    const planLimit = plan?.limits?.storage_bytes ?? null;
    const storageLimit =
      tenant.status === "trialing" && trialStorageLimit != null
        ? planLimit != null
          ? Math.min(planLimit, trialStorageLimit)
          : trialStorageLimit
        : planLimit;
    return {
      ...tenant,
      plan_name: plan?.name ?? "—",
      items_count: usageRow?.items_count ?? 0,
      quotes_month: usageRow?.quotes_this_month ?? 0,
      storage_bytes: usageRow?.storage_bytes ?? 0,
      storage_limit: storageLimit,
      current_period_end: sub?.current_period_end ?? null,
      cancel_at_period_end: sub?.cancel_at_period_end ?? null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

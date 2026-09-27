import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AdminTenantRow } from "@/lib/types";

const SELECT = "*, plans(name), usage(items_count, quotes_this_month)";

type Joined = Omit<AdminTenantRow, "plan_name" | "items_count" | "quotes_month"> & {
  plans: { name: string } | { name: string }[] | null;
  usage: { items_count: number; quotes_this_month: number } | { items_count: number; quotes_this_month: number }[] | null;
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

export async function getTenantForAdmin(id: string): Promise<AdminTenantRow | null> {
  const { data, error } = await createServiceRoleClient()
    .from("tenants")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toRow(data as unknown as Joined);
}

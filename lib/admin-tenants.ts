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
export async function listTenantsForAdmin(): Promise<AdminTenantRow[]> {
  const { data, error } = await createServiceRoleClient()
    .from("tenants")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar los tenants: ${error.message}`);
  return ((data ?? []) as unknown as Joined[]).map(toRow);
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

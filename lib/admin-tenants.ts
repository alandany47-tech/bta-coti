import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AdminTenantRow } from "@/lib/types";

/**
 * Tenants + conteos de properties/quotes para la Master Console. Vía
 * service role: quotes no tiene policy de select para authenticated (a
 * propósito, ver 0001), así que no hay forma de armar este conteo
 * cross-tenant respetando RLS. Quien llame a esto YA debe haber validado
 * getAdminUser() — acá no hay ninguna otra barrera.
 */
export async function listTenantsForAdmin(): Promise<AdminTenantRow[]> {
  const supabase = createServiceRoleClient();

  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No se pudieron cargar los tenants: ${error.message}`);

  const tenantIds = (tenants ?? []).map((t) => t.id);

  const countBy = (rows: { tenant_id: string }[] | null) => {
    const map = new Map<string, number>();
    (rows ?? []).forEach((r) =>
      map.set(r.tenant_id, (map.get(r.tenant_id) ?? 0) + 1),
    );
    return map;
  };

  let propertyCounts = new Map<string, number>();
  let quoteCounts = new Map<string, number>();

  // .in() con un array vacío genera un `in ()` inválido en PostgREST.
  if (tenantIds.length > 0) {
    const [{ data: properties }, { data: quotes }] = await Promise.all([
      supabase.from("properties").select("tenant_id").in("tenant_id", tenantIds),
      supabase.from("quotes").select("tenant_id").in("tenant_id", tenantIds),
    ]);
    propertyCounts = countBy(properties);
    quoteCounts = countBy(quotes);
  }

  return (tenants ?? []).map((tenant) => ({
    ...tenant,
    properties_count: propertyCounts.get(tenant.id) ?? 0,
    quotes_count: quoteCounts.get(tenant.id) ?? 0,
  }));
}

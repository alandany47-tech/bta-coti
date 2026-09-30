import { listTenantsForAdminPaged } from "@/lib/admin-tenants";
import { AdminConsole } from "@/components/admin/admin-console";
import { ClientesFiltros } from "@/components/admin/clientes-filtros";
import { Pagination } from "@/components/ui/pagination";
import { ADMIN_PLANS } from "@/lib/admin-new-client";
import { BRAND } from "@/lib/brand";
import type { TenantStatus } from "@/lib/types";

const PLAN_LABEL: Record<string, string> = {
  esencial: "Esencial",
  catalogo: "Catálogo",
  broker: "Broker",
  broker_pro: "Broker Pro",
};

const ORIGINS = ["self_signup", "admin", "demo_clone"] as const;

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; origin?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const origin = ORIGINS.includes(sp.origin as (typeof ORIGINS)[number]) ? (sp.origin as (typeof ORIGINS)[number]) : undefined;

  const { rows, total, pageSize } = await listTenantsForAdminPaged({
    search: sp.q,
    status: sp.status as TenantStatus | undefined,
    planCode: sp.plan,
    origin,
    page,
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ClientesFiltros
        basePath="/admin/clientes"
        initial={{ q: sp.q ?? "", status: sp.status ?? "", plan: sp.plan ?? "", origin: sp.origin ?? "" }}
        planOptions={ADMIN_PLANS.map((code) => ({ code, name: PLAN_LABEL[code] ?? code }))}
      />
      <AdminConsole
        key={`${page}-${sp.q ?? ""}-${sp.status ?? ""}-${sp.plan ?? ""}-${sp.origin ?? ""}`}
        initialTenants={rows}
        rootDomain={BRAND.domain}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        basePath="/admin/clientes"
        query={{ q: sp.q, status: sp.status, plan: sp.plan, origin: sp.origin }}
      />
    </div>
  );
}

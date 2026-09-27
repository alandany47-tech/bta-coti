import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import { listTenantsForAdmin, listDemoTenantsForAdmin } from "@/lib/admin-tenants";
import { DemoSection } from "@/components/admin/demo-section";
import { AdminConsole } from "@/components/admin/admin-console";
import { LogoutButton } from "@/components/admin/logout-button";
import { BRAND } from "@/lib/brand";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?next=/admin");

  const [tenants, demoTenants] = await Promise.all([listTenantsForAdmin(), listDemoTenantsForAdmin()]);
  const rootDomain = BRAND.domain;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-foreground">
            {BRAND.name} Master Console
          </span>
          <span className="text-xs text-muted">{admin.email}</span>
        </div>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-6">
        <DemoSection initialTenants={demoTenants} rootDomain={rootDomain} />
        <AdminConsole initialTenants={tenants} rootDomain={rootDomain} />
      </main>
    </div>
  );
}

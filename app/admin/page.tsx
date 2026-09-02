import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import { listTenantsForAdmin } from "@/lib/admin-tenants";
import { AdminConsole } from "@/components/admin/admin-console";
import { LogoutButton } from "@/components/admin/logout-button";

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  const tenants = await listTenantsForAdmin();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "btacotiza.com";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-foreground">
            BTA Cotiza Master Console
          </span>
          <span className="text-xs text-muted">{admin.email}</span>
        </div>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-6">
        <AdminConsole initialTenants={tenants} rootDomain={rootDomain} />
      </main>
    </div>
  );
}

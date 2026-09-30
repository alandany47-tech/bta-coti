import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin-auth";
import { LogoutButton } from "@/components/admin/logout-button";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/pagos", label: "Pagos" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/login?next=/admin");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-foreground">{BRAND.name} Master Console</span>
          <span className="text-xs text-muted">{admin.email}</span>
        </div>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border-subtle p-4 text-sm text-foreground-muted">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 hover:bg-surface hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex flex-1 flex-col gap-4 p-6">{children}</main>
      </div>
    </div>
  );
}

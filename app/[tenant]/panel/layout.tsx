import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { rootOrigin } from "@/lib/auth/redirects";
import { TenantMark } from "@/components/tenant-mark";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { tenant, user, role } = await getPanelContext(slug);
  const host = (await headers()).get("host") ?? "";
  const canEdit = hasRole(role, "editor");

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border-subtle px-6 py-4">
        <TenantMark tenant={tenant} subtitle="Panel" />
        <nav className="flex gap-4 text-sm text-foreground-muted">
          <Link href="/panel" className="hover:text-foreground">
            Cotizador
          </Link>
          <Link href="/panel/cotizaciones" className="hover:text-foreground">
            Cotizaciones
          </Link>
          <Link href="/panel/mensajes" className="hover:text-foreground">
            Mensajes
          </Link>
          {canEdit ? (
            <>
              <Link href="/panel/propiedades" className="hover:text-foreground">
                Propiedades
              </Link>
              <Link href="/panel/importar" className="hover:text-foreground">
                Importar cartera
              </Link>
            </>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
          <form action={`${rootOrigin(host)}/auth/logout`} method="post">
            <button type="submit" className="text-muted hover:text-foreground">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}

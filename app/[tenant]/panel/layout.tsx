import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { rootOrigin } from "@/lib/auth/redirects";
import { TenantMark } from "@/components/tenant-mark";
import { DemoBanner } from "@/components/demo-banner";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const h = await headers();
  // /panel/facturacion es la única página que un tenant suspended/canceled puede ver (para pagar y
  // reactivarse); el resto sigue mandando a /suspended. Debe llamarse con el mismo `anyStatus`
  // exacto que la página (React.cache compara los argumentos con Object.is) para no duplicar la
  // consulta en el caso normal.
  const isBilling = (h.get("x-tenant-pathname") ?? "").startsWith("/panel/facturacion");
  const { tenant, user, role } = isBilling ? await getPanelContext(slug, true) : await getPanelContext(slug);
  const host = h.get("host") ?? "";
  const canEdit = hasRole(role, "editor");

  return (
    <>
      {tenant.is_demo ? <DemoBanner registroUrl={`${rootOrigin(host)}/registro`} /> : null}
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
          {tenant.is_demo ? null : (
            <Link href="/panel/facturacion" className="hover:text-foreground">
              Facturación
            </Link>
          )}
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

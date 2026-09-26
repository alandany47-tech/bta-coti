import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTenantBySlug } from "@/lib/tenants";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";
import { TenantMark } from "@/components/tenant-mark";
import { BRAND } from "@/lib/brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  // Los sitios en prueba no se indexan (ABUSE-AND-LIMITS §3.3).
  return {
    title: tenant?.name ?? BRAND.name,
    robots: tenant?.status === "trialing" ? { index: false, follow: false } : undefined,
  };
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const host = (await headers()).get("host") ?? "";
  const loginHref = `${rootOrigin(host)}/login?next=${encodeURIComponent(`${tenantOrigin(slug, host)}/panel`)}`;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
        <TenantMark tenant={tenant} subtitle="Propiedades" />
        <a href={loginHref} className="ml-auto text-sm text-foreground-muted hover:text-foreground">
          Acceso
        </a>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      {tenant.status === "trialing" ? (
        <footer className="border-t border-border-subtle px-6 py-4 text-center text-xs text-muted">
          Sitio creado con {BRAND.name}
        </footer>
      ) : null}
    </>
  );
}

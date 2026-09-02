import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);

  if (!tenant) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border-subtle px-6 py-4">
        {tenant.logo_url ? (
          // El logo vive en Supabase Storage (host distinto por proyecto), por
          // lo que next/image exigiría configurar remotePatterns dinámicamente.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            width={32}
            height={32}
            className="h-8 w-8 rounded object-contain"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded text-sm font-semibold text-background"
            style={{ backgroundColor: tenant.brand_color }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-foreground">{tenant.name}</span>
          <span className="text-xs text-muted">Cotizador</span>
        </div>
        <nav className="ml-auto flex gap-4 text-sm text-foreground-muted">
          <Link href={`/${slug}`} className="hover:text-foreground">
            Cotizador
          </Link>
          <Link href={`/${slug}/properties`} className="hover:text-foreground">
            Propiedades
          </Link>
          <Link href={`/${slug}/catalog`} className="hover:text-foreground">
            Importar cartera
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

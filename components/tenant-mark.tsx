import type { PublicTenant } from "@/lib/types";

export function TenantMark({ tenant, subtitle }: { tenant: PublicTenant; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
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
        <span className="text-xs text-muted">{subtitle}</span>
      </div>
    </div>
  );
}

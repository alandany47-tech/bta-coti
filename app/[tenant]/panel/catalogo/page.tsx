import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CatalogManager } from "@/components/catalog-admin/catalog-manager";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { tenantOrigin } from "@/lib/auth/redirects";
import { CATALOG_COLUMNS, getAllowedKinds, type CatalogRow } from "@/lib/catalog-admin";
import { mediaUrl } from "@/lib/media";

export default async function CatalogAdminPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");

  const kinds = await getAllowedKinds(supabase, tenant.id);
  if (kinds.length === 0) redirect("/panel");

  const [{ data: items }, { data: media }] = await Promise.all([
    supabase
      .from("items")
      .select(CATALOG_COLUMNS)
      .eq("tenant_id", tenant.id)
      .in("kind", ["product", "service"])
      .order("created_at", { ascending: false }),
    supabase.from("media").select("id, r2_key").eq("tenant_id", tenant.id).eq("status", "ready"),
  ]);
  const mediaIds = Object.fromEntries((media ?? []).map((m) => [mediaUrl(m.r2_key), m.id]));
  const host = (await headers()).get("host") ?? "";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Catálogo</h1>
        <p className="text-sm text-ink-2">
          Lo que ven tus clientes en tu página. Agrega fotos, precio y los datos que quieras mostrar;
          ellos arman su cotización y te la mandan por WhatsApp.
        </p>
      </div>
      <CatalogManager
        tenantSlug={slug}
        initialItems={(items ?? []) as CatalogRow[]}
        initialMediaIds={mediaIds}
        kinds={kinds}
        catalogUrl={tenantOrigin(slug, host)}
        isDemo={tenant.is_demo}
      />
    </div>
  );
}

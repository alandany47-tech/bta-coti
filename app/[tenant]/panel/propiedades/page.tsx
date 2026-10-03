import { redirect } from "next/navigation";
import { getPanelContext, hasRole, requireBrokerModule } from "@/lib/auth/panel";
import { PropertiesManager } from "@/components/properties/properties-manager";
import { mediaUrl } from "@/lib/media";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");
  await requireBrokerModule(tenant.id);

  const { data: properties } = await supabase
    .from("items")
    .select(PROPERTY_COLUMNS)
    .eq("tenant_id", tenant.id)
    .eq("kind", "property")
    .neq("status", "hidden")
    .order("sku", { ascending: true });

  const { data: media } = await supabase
    .from("media")
    .select("id, r2_key")
    .eq("tenant_id", tenant.id)
    .eq("status", "ready");
  const mediaIds = Object.fromEntries((media ?? []).map((m) => [mediaUrl(m.r2_key), m.id]));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Propiedades</h1>
        <p className="text-sm text-muted">
          Sube las fotos y el plano de cada propiedad; se optimizan en tu navegador
          antes de subirse. Alimentan la galería del dossier en PDF y el selector del cotizador.
        </p>
      </div>

      <PropertiesManager
        tenantSlug={slug}
        initialProperties={(properties ?? []).map(itemToProperty)}
        initialMediaIds={mediaIds}
      />
    </div>
  );
}

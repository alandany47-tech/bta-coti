import { getPanelContext } from "@/lib/auth/panel";
import { CotizadorClient } from "@/components/cotizador/cotizador-client";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";

export default async function CotizadorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { supabase, tenant } = await getPanelContext(slug);

  const { data: properties } = await supabase
    .from("items")
    .select(PROPERTY_COLUMNS)
    .eq("tenant_id", tenant.id)
    .eq("kind", "property")
    .in("status", ["available", "reserved"])
    .order("sku", { ascending: true });

  return (
    <CotizadorClient
      tenantSlug={slug}
      properties={(properties ?? []).map(itemToProperty)}
    />
  );
}

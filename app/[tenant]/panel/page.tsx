import { headers } from "next/headers";
import { getPanelContext } from "@/lib/auth/panel";
import { rootOrigin } from "@/lib/auth/redirects";
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

  const host = (await headers()).get("host") ?? "";

  return (
    <CotizadorClient
      tenantSlug={slug}
      properties={(properties ?? []).map(itemToProperty)}
      isDemo={tenant.is_demo}
      registroUrl={`${rootOrigin(host)}/registro`}
    />
  );
}

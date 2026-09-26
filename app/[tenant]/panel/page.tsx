import { getPanelContext } from "@/lib/auth/panel";
import { CotizadorClient } from "@/components/cotizador/cotizador-client";
import type { Property } from "@/lib/types";

export default async function CotizadorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { supabase, tenant } = await getPanelContext(slug);

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("tenant_id", tenant.id)
    .neq("status", "sold")
    .order("unit_number", { ascending: true });

  return (
    <CotizadorClient
      tenantSlug={slug}
      properties={(properties ?? []) as Property[]}
    />
  );
}

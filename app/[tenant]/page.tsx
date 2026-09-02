import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CotizadorClient } from "@/components/cotizador/cotizador-client";
import type { Product } from "@/lib/types";

export default async function CotizadorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const supabase = createServerSupabaseClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("name", { ascending: true });

  return (
    <CotizadorClient
      tenantSlug={slug}
      products={(products ?? []) as Product[]}
    />
  );
}

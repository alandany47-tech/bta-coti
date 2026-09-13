import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CotizadorClient } from "@/components/cotizador/cotizador-client";
import type { Property } from "@/lib/types";

export default async function CotizadorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const supabase = createServerSupabaseClient();
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

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPanelContext, getPanelModules, hasRole } from "@/lib/auth/panel";
import { rootOrigin } from "@/lib/auth/redirects";
import { CotizadorClient } from "@/components/cotizador/cotizador-client";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";

export default async function CotizadorPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);

  // Sin módulo `broker` no hay cotizador de propiedades: el negocio entra a administrar su catálogo.
  if (!(await getPanelModules(tenant.id)).includes("broker")) {
    if (hasRole(role, "editor")) redirect("/panel/catalogo");
    return (
      <div className="mx-auto w-full max-w-xl p-6 text-sm text-ink-2">
        Tu acceso es de solo lectura. Pide a quien administra {tenant.name} que te dé permisos de edición.
      </div>
    );
  }

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

import { redirect } from "next/navigation";
import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { PropertiesManager } from "@/components/properties/properties-manager";
import type { Property } from "@/lib/types";

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");

  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("unit_number", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Propiedades</h1>
        <p className="text-sm text-muted">
          Sube hasta 10 imágenes y el plano de cada propiedad. Esto alimenta
          la galería del dossier en PDF y el selector del cotizador.
        </p>
      </div>

      <PropertiesManager
        tenantSlug={slug}
        initialProperties={(properties ?? []) as Property[]}
      />
    </div>
  );
}

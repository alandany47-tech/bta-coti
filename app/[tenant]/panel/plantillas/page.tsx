import { redirect } from "next/navigation";
import { TemplatePicker } from "@/components/quote/template-picker";
import { getPanelContext, getPanelModules, hasRole, requireQuotingModule } from "@/lib/auth/panel";
import { itemToProperty, PROPERTY_COLUMNS } from "@/lib/items";
import { isQuoteTemplateCode, safeBrandColor, DEFAULT_QUOTE_TEMPLATE } from "@/lib/quote-templates";

export default async function TemplatesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);
  if (!hasRole(role, "editor")) redirect("/panel");
  await requireQuotingModule(tenant.id);
  const modules = await getPanelModules(tenant.id);
  const kinds: ("property" | "services")[] = [...(modules.includes("broker") ? (["property"] as const) : []), ...(modules.includes("services") ? (["services"] as const) : [])];

  const [{ data: row }, { data: property }] = await Promise.all([
    supabase.from("tenants").select("plan_id").eq("id", tenant.id).maybeSingle(),
    supabase
      .from("items")
      .select(PROPERTY_COLUMNS)
      .eq("tenant_id", tenant.id)
      .eq("kind", "property")
      .in("status", ["available", "reserved"])
      .order("sku", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const { data: plan } = row?.plan_id
    ? await supabase.from("plans").select("limits").eq("id", row.plan_id).maybeSingle()
    : { data: null };
  const rawLimit = (plan?.limits as { templates?: number | null } | null)?.templates;
  const planLimit = typeof rawLimit === "number" ? rawLimit : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Plantillas de cotización</h1>
        <p className="text-sm text-ink-2">
          Elige cómo se ven tus cotizaciones en la página que recibe tu cliente y en el PDF. Cambiar de plantilla no
          cambia ningún monto, y las cotizaciones que ya enviaste se quedan como estaban.
        </p>
      </div>
      <TemplatePicker
        tenantSlug={slug}
        tenantName={tenant.name}
        logoUrl={tenant.logo_url}
        brandColor={safeBrandColor(tenant.brand_color)}
        initialCode={isQuoteTemplateCode(tenant.quote_template) ? tenant.quote_template : DEFAULT_QUOTE_TEMPLATE}
        planLimit={planLimit}
        property={property ? itemToProperty(property) : null}
        createdAt={new Date().toISOString()}
        isDemo={tenant.is_demo}
        kinds={kinds}
      />
    </div>
  );
}

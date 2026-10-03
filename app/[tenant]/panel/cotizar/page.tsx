import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ServicesQuoteBuilder, type QuoteCatalogItem } from "@/components/quote-services/services-quote-builder";
import { getPanelContext, getPanelModules } from "@/lib/auth/panel";
import { rootOrigin } from "@/lib/auth/redirects";

export default async function QuoteServicesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant } = await getPanelContext(slug);
  if (!(await getPanelModules(tenant.id)).includes("services")) redirect("/panel");

  const { data } = await supabase
    .from("items")
    .select("id, title, price, unit, category")
    .eq("tenant_id", tenant.id)
    .in("kind", ["service", "product"])
    .eq("status", "available")
    .order("title", { ascending: true })
    .limit(500);
  const items: QuoteCatalogItem[] = (data ?? []).map((i) => ({ id: i.id, title: i.title, price: Number(i.price), unit: i.unit, category: i.category }));
  const host = (await headers()).get("host") ?? "";

  return <ServicesQuoteBuilder tenantSlug={slug} items={items} isDemo={tenant.is_demo} registroUrl={`${rootOrigin(host)}/registro`} />;
}

import { getPanelContext, getPanelModules, hasRole } from "@/lib/auth/panel";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function WelcomePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant, role } = await getPanelContext(slug);

  const [modules, { data: usage }, { count: quotesCount }] = await Promise.all([
    getPanelModules(tenant.id),
    supabase.from("usage").select("items_count").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("quotes").select("id", { head: true, count: "exact" }).eq("tenant_id", tenant.id),
  ]);

  return (
    <OnboardingWizard
      tenant={tenant}
      hasItems={(usage?.items_count ?? 0) > 0}
      hasQuotes={(quotesCount ?? 0) > 0}
      canImport={hasRole(role, "editor")}
      mode={modules.includes("broker") ? "broker" : modules.includes("catalog") ? "catalog" : "services"}
      hasWhatsapp={Boolean(tenant.whatsapp)}
    />
  );
}

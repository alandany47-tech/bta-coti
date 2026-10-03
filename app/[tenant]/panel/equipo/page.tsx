import { redirect } from "next/navigation";
import { TeamManager } from "@/components/team/team-manager";
import { getPanelContext } from "@/lib/auth/panel";
import type { TeamOverview } from "@/lib/team";

export default async function TeamPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { supabase, tenant, user, role } = await getPanelContext(slug);
  if (role !== "owner") redirect("/panel");

  const { data, error } = await supabase.rpc("team_overview", { p_tenant: tenant.id });
  if (error || !data) redirect("/panel");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Equipo</h1>
        <p className="text-sm text-ink-2">
          Suma a tu gente para cotizar y administrar {tenant.name}. Cada persona entra con su propio correo; tú decides qué
          puede hacer y puedes quitar su acceso cuando quieras.
        </p>
      </div>
      <TeamManager tenantSlug={slug} overview={data as unknown as TeamOverview} currentUserId={user.id} isDemo={tenant.is_demo} isTrial={tenant.status === "trialing"} />
    </div>
  );
}

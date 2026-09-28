import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin, getTenantPlanCode } from "@/lib/admin-tenants";
import { logAudit } from "@/lib/admin-status";
import { validateCloneProspect } from "@/lib/admin-new-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rootOrigin } from "@/lib/auth/redirects";
import { tenantTag } from "@/lib/tenants";
import { revalidateTag } from "next/cache";

const TRIAL_DAYS = 7;

/** "Clonar demo como prospecto-x" (docs/DEMO.md §4): copia catálogo y marca a un tenant nuevo en prueba. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { tenantId } = await params;
  const source = await getTenantForAdmin(tenantId);
  if (!source || !source.is_demo) {
    return NextResponse.json({ error: "Ese tenant no es una demo." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateCloneProspect(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const prospect = parsed.value;

  const supabase = createServiceRoleClient();

  const { data: free } = await supabase.rpc("slug_available", { p_slug: prospect.slug });
  if (free !== true) {
    return NextResponse.json({ error: "Ese subdominio no está disponible." }, { status: 409 });
  }

  const planCode = await getTenantPlanCode(tenantId);
  if (!planCode) return NextResponse.json({ error: "No se pudo determinar el plan de la demo." }, { status: 500 });

  const { data: existingId } = await supabase.rpc("admin_user_id_by_email", { p_email: prospect.ownerEmail });
  let ownerId: string | null = existingId ?? null;
  let invited = false;

  if (!ownerId) {
    const host = request.headers.get("host") ?? "";
    const redirectTo = new URL("/auth/callback", rootOrigin(host));
    redirectTo.searchParams.set("src", "invite");
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(prospect.ownerEmail, {
      redirectTo: redirectTo.toString(),
    });
    if (error || !data.user) {
      console.error("inviteUserByEmail (clonar demo) falló", error?.message);
      return NextResponse.json({ error: "No se pudo enviar la invitación al correo del dueño." }, { status: 502 });
    }
    ownerId = data.user.id;
    invited = true;
  }

  const { data: tenantId2, error: provisionError } = await supabase.rpc("provision_tenant", {
    p_owner: ownerId,
    p_name: prospect.name,
    p_slug: prospect.slug,
    p_plan_code: planCode,
    p_status: "trialing",
    p_trial_days: TRIAL_DAYS,
    p_source: "demo_clone",
    p_billing_mode: "manual",
  });

  if (provisionError || !tenantId2) {
    if (invited) await supabase.auth.admin.deleteUser(ownerId);
    const taken = provisionError?.message.includes("slug_taken") || provisionError?.message.includes("slug_invalid");
    if (!taken) console.error("provision_tenant (clonar demo) falló", provisionError?.message);
    return NextResponse.json(
      { error: taken ? "Ese subdominio no está disponible." : "No se pudo crear el tenant." },
      { status: taken ? 409 : 500 },
    );
  }

  const { error: cloneError } = await supabase.rpc("clone_demo_items", { p_source: tenantId, p_target: tenantId2 });
  if (cloneError) {
    console.error("clone_demo_items falló", cloneError.message);
    await supabase.from("tenants").delete().eq("id", tenantId2);
    if (invited) await supabase.auth.admin.deleteUser(ownerId);
    return NextResponse.json({ error: "No se pudo copiar el catálogo de la demo." }, { status: 500 });
  }

  await logAudit("tenant.cloned_from_demo", tenantId2, admin.id, {
    source_tenant_id: tenantId,
    source_slug: source.slug,
    slug: prospect.slug,
    owner_email: prospect.ownerEmail,
    invited,
  });

  revalidateTag(tenantTag(prospect.slug), { expire: 0 });
  const tenant = await getTenantForAdmin(tenantId2);
  return NextResponse.json({ tenant, invited }, { status: 201 });
}

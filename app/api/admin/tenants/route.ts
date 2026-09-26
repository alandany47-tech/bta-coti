import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin, listTenantsForAdmin } from "@/lib/admin-tenants";
import { logAudit } from "@/lib/admin-status";
import { validateNewClient } from "@/lib/admin-new-client";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rootOrigin } from "@/lib/auth/redirects";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const tenants = await listTenantsForAdmin();
    return NextResponse.json({ tenants });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron cargar los tenants." },
      { status: 500 },
    );
  }
}

/** Vía B (AUTH-ONBOARDING §3): alta manual con invitación al dueño y provisión. */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = validateNewClient(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const client = parsed.value;

  const supabase = createServiceRoleClient();

  const { data: free } = await supabase.rpc("slug_available", { p_slug: client.slug });
  if (free !== true) {
    return NextResponse.json({ error: "Ese subdominio no está disponible." }, { status: 409 });
  }

  const { data: existingId } = await supabase.rpc("admin_user_id_by_email", { p_email: client.ownerEmail });
  let ownerId: string | null = existingId ?? null;
  let invited = false;

  if (!ownerId) {
    const host = request.headers.get("host") ?? "";
    const redirectTo = new URL("/auth/callback", rootOrigin(host));
    redirectTo.searchParams.set("src", "invite");
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(client.ownerEmail, {
      redirectTo: redirectTo.toString(),
    });
    if (error || !data.user) {
      console.error("inviteUserByEmail falló", error?.message);
      return NextResponse.json({ error: "No se pudo enviar la invitación al correo del dueño." }, { status: 502 });
    }
    ownerId = data.user.id;
    invited = true;
  }

  const { data: tenantId, error } = await supabase.rpc("provision_tenant", {
    p_owner: ownerId,
    p_name: client.name,
    p_slug: client.slug,
    p_plan_code: client.plan,
    p_status: client.status,
    p_trial_days: client.trialDays,
    p_source: "admin",
    p_billing_mode: client.billingMode,
  });

  if (error || !tenantId) {
    if (invited) await supabase.auth.admin.deleteUser(ownerId);
    const taken = error?.message.includes("slug_taken") || error?.message.includes("slug_invalid");
    if (!taken) console.error("provision_tenant (admin) falló", error?.message);
    return NextResponse.json(
      { error: taken ? "Ese subdominio no está disponible." : "No se pudo crear el cliente." },
      { status: taken ? 409 : 500 },
    );
  }

  if (client.notes) await supabase.from("tenants").update({ notes: client.notes }).eq("id", tenantId);

  await logAudit("tenant.created_by_admin", tenantId, admin.id, {
    slug: client.slug,
    plan: client.plan,
    status: client.status,
    billing_mode: client.billingMode,
    owner_id: ownerId,
    owner_email: client.ownerEmail,
    invited,
  });

  const tenant = await getTenantForAdmin(tenantId);
  return NextResponse.json({ tenant, invited }, { status: 201 });
}

import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin } from "@/lib/admin-tenants";
import { logAudit, setTenantStatus, STATUSES_REQUIRING_REASON, TENANT_STATUSES } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tenantTag } from "@/lib/tenants";
import type { TenantStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { tenantId } = await params;
  const body = await request.json().catch(() => ({}));

  const hasStatus = body.status !== undefined;
  const hasNotes = body.notes !== undefined;
  const hasPlan = body.planCode !== undefined;
  const hasExtendTrial = body.extendTrialDays !== undefined;
  if (!hasStatus && !hasNotes && !hasPlan && !hasExtendTrial) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
  }

  if (hasStatus) {
    if (!TENANT_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    const status = body.status as TenantStatus;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (STATUSES_REQUIRING_REASON.includes(status) && !reason) {
      return NextResponse.json({ error: "Indica el motivo del cambio." }, { status: 400 });
    }
    const result = await setTenantStatus(tenantId, status, reason || null, admin.id);
    if (!result.ok) {
      const notFound = result.code === "not_found";
      return NextResponse.json(
        { error: notFound ? "Tenant no encontrado." : "No se pudo actualizar el tenant." },
        { status: notFound ? 404 : 500 },
      );
    }
  }

  if (hasNotes) {
    const notes = body.notes === null ? null : String(body.notes).slice(0, 5000);
    const { error } = await createServiceRoleClient().from("tenants").update({ notes }).eq("id", tenantId);
    if (error) {
      return NextResponse.json({ error: "No se pudieron guardar las notas." }, { status: 500 });
    }
    await logAudit("tenant.notes_updated", tenantId, admin.id);
  }

  if (hasPlan) {
    if (body.planCode === "trial") {
      return NextResponse.json({ error: "El plan de prueba no se puede asignar a un tenant." }, { status: 400 });
    }
    const supabase = createServiceRoleClient();
    const { data: current } = await supabase.from("tenants").select("plan_id, plans(code)").eq("id", tenantId).maybeSingle();
    if (!current) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
    const { data: plan } = await supabase.from("plans").select("id, code").eq("code", String(body.planCode)).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Plan no encontrado." }, { status: 400 });
    const { error } = await supabase.from("tenants").update({ plan_id: plan.id }).eq("id", tenantId);
    if (error) return NextResponse.json({ error: "No se pudo cambiar el plan." }, { status: 500 });
    const fromCode = (current as { plans: { code: string } | { code: string }[] | null }).plans;
    const from = Array.isArray(fromCode) ? fromCode[0]?.code : fromCode?.code;
    await logAudit("tenant.plan_changed_by_admin", tenantId, admin.id, { from: from ?? null, to: plan.code });
  }

  if (hasExtendTrial) {
    const days = Number(body.extendTrialDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return NextResponse.json({ error: "Los días de extensión deben ser un entero de 1 a 90." }, { status: 400 });
    }
    const supabase = createServiceRoleClient();
    const { data: current } = await supabase.from("tenants").select("slug, status, trial_ends_at").eq("id", tenantId).maybeSingle();
    if (!current) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
    if (current.status !== "trialing") {
      return NextResponse.json({ error: "Solo se puede extender la prueba de un tenant en prueba." }, { status: 400 });
    }
    const base = current.trial_ends_at && new Date(current.trial_ends_at) > new Date() ? new Date(current.trial_ends_at) : new Date();
    const newTrialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("tenants").update({ trial_ends_at: newTrialEndsAt }).eq("id", tenantId);
    if (error) return NextResponse.json({ error: "No se pudo extender la prueba." }, { status: 500 });
    revalidateTag(tenantTag(current.slug), { expire: 0 });
    await logAudit("tenant.trial_extended", tenantId, admin.id, { days, new_trial_ends_at: newTrialEndsAt });
  }

  const tenant = await getTenantForAdmin(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  return NextResponse.json({ tenant });
}

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin } from "@/lib/admin-tenants";
import { logAudit, setTenantStatus, STATUSES_REQUIRING_REASON, TENANT_STATUSES } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
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
  if (!hasStatus && !hasNotes) {
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

  const tenant = await getTenantForAdmin(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  return NextResponse.json({ tenant });
}

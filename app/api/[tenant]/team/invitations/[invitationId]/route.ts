import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid } from "@/lib/media";
import { teamErrorResponse } from "@/lib/team";

/** Cancela una invitación pendiente (el enlace deja de servir). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ tenant: string; invitationId: string }> }) {
  const { tenant: slug, invitationId } = await params;
  if (!isUuid(invitationId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const { error } = await supabase.rpc("revoke_invitation", { p_tenant: tenant.id, p_invitation: invitationId });
  if (error) {
    const failure = teamErrorResponse(error.message);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

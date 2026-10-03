import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isUuid } from "@/lib/media";
import { isTeamRole, teamErrorResponse } from "@/lib/team";

type Ctx = { params: Promise<{ tenant: string; userId: string }> };

/** Cambia el rol de un miembro (solo dueño; el dueño mismo no se cambia). */
export async function PATCH(request: Request, { params }: Ctx) {
  const { tenant: slug, userId } = await params;
  if (!isUuid(userId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (!isTeamRole(body?.role)) return NextResponse.json({ error: "Rol inválido." }, { status: 400 });

  const { error } = await supabase.rpc("set_member_role", { p_tenant: tenant.id, p_user: userId, p_role: body.role });
  if (error) {
    const failure = teamErrorResponse(error.message);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

/** Quita a un miembro del equipo (no al dueño ni a uno mismo). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { tenant: slug, userId } = await params;
  if (!isUuid(userId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const { error } = await supabase.rpc("remove_member", { p_tenant: tenant.id, p_user: userId });
  if (error) {
    const failure = teamErrorResponse(error.message);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { rootOrigin } from "@/lib/auth/redirects";
import { buildInviteEmail } from "@/emails/templates";
import { emailConfigured, sendEmail } from "@/lib/email/send";
import { isTeamRole, newInvitationToken, normalizeInviteEmail, ROLE_HELP, ROLE_LABEL, teamErrorResponse, type TeamOverview } from "@/lib/team";

/**
 * Invitar (o reenviar: la invitación pendiente del mismo correo se reemplaza) a alguien al equipo (T33).
 * Solo el dueño. Va con el cliente de sesión: las funciones de 0035 revalidan dueño, tenant operable, tope
 * del plan y demo. No hay service role aquí: el token se acepta en /invitacion/<token>.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "owner");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant, user } = access;

  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo no se puede administrar el equipo." }, { status: 403 });
  }
  // Sin correo transaccional la invitación nunca llegaría: mejor no crearla.
  if (!emailConfigured()) {
    return NextResponse.json({ error: "El envío de correos todavía no está configurado." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  const email = normalizeInviteEmail(body?.email);
  if (!email) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  if (!isTeamRole(body?.role)) return NextResponse.json({ error: "Elige un rol." }, { status: 400 });

  const { token, hash } = newInvitationToken();
  const { data: expiresAt, error } = await supabase.rpc("create_invitation", {
    p_tenant: tenant.id,
    p_email: email,
    p_role: body.role,
    p_token_hash: hash,
  });
  if (error) {
    const failure = teamErrorResponse(error.message);
    if (failure.status === 500) console.error("create_invitation falló", error.message);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  const url = `${rootOrigin(request.headers.get("host") ?? "")}/invitacion/${token}`;
  const { subject, element } = buildInviteEmail({
    tenantName: tenant.name,
    inviterEmail: user.email ?? "El dueño",
    roleLabel: ROLE_LABEL[body.role],
    roleHelp: ROLE_HELP[body.role],
    url,
    expiresAt: String(expiresAt),
  });
  const sent = await sendEmail({ to: email, subject, element });
  if (!sent.ok) {
    console.error("invitación no enviada:", sent.error);
    // Se retira la invitación para no dejar un lugar ocupado por un correo que nunca salió.
    const { data } = await supabase.rpc("team_overview", { p_tenant: tenant.id });
    const pending = (data as TeamOverview | null)?.invitations.find((i) => i.email === email);
    if (pending) await supabase.rpc("revoke_invitation", { p_tenant: tenant.id, p_invitation: pending.id });
    return NextResponse.json({ error: "No se pudo enviar el correo de invitación. Intenta de nuevo." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, expiresAt });
}

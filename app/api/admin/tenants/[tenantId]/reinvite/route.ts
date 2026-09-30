import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantMembers } from "@/lib/admin-tenants";
import { logAudit } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rootOrigin } from "@/lib/auth/redirects";

/** Botón "Reenviar invitación" del Cliente-detalle: reintenta el correo de invite al dueño. */
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { tenantId } = await params;
  const members = await getTenantMembers(tenantId);
  const owner = members.find((m) => m.role === "owner");
  if (!owner?.email) return NextResponse.json({ error: "No se encontró el correo del dueño." }, { status: 404 });

  const host = request.headers.get("host") ?? "";
  const redirectTo = new URL("/auth/callback", rootOrigin(host));
  redirectTo.searchParams.set("src", "invite");
  const { error } = await createServiceRoleClient().auth.admin.inviteUserByEmail(owner.email, {
    redirectTo: redirectTo.toString(),
  });
  if (error) {
    const alreadyConfirmed = error.message.toLowerCase().includes("already been registered") || error.message.toLowerCase().includes("already registered");
    return NextResponse.json(
      {
        error: alreadyConfirmed
          ? "El dueño ya tiene cuenta activa: usa 'Entrar como soporte' o dile que use /recuperar."
          : "No se pudo reenviar la invitación.",
      },
      { status: alreadyConfirmed ? 409 : 502 },
    );
  }

  await logAudit("tenant.reinvited", tenantId, admin.id, { owner_email: owner.email });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { getTenantForAdmin, getTenantMembers } from "@/lib/admin-tenants";
import { logAudit } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";

/**
 * "Entrar como soporte" (docs/ADMIN-PANEL.md §2): acceso completo al panel del dueño, no
 * solo-lectura (decisión ya tomada con Alan) — se audita en `audit_log` al generar el link, no al
 * usarlo (no hay forma de saber si se llegó a abrir).
 *
 * `generateLink` no se usa con su `action_link` directo: ese apunta al verify hosteado de
 * Supabase, y este proyecto ya resuelve `/auth/callback` a mano con `token_hash`+`type` (igual que
 * las invitaciones, cuyo correo también apunta aquí). Se reconstruye la URL con
 * `properties.hashed_token` para reusar exactamente ese mismo camino.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { tenantId } = await params;
  const tenant = await getTenantForAdmin(tenantId);
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });

  const members = await getTenantMembers(tenantId);
  const owner = members.find((m) => m.role === "owner");
  if (!owner?.email) return NextResponse.json({ error: "No se encontró el correo del dueño." }, { status: 404 });

  const host = request.headers.get("host") ?? "";
  const { data, error } = await createServiceRoleClient().auth.admin.generateLink({
    type: "magiclink",
    email: owner.email,
  });
  if (error || !data) {
    return NextResponse.json({ error: "No se pudo generar el link de acceso." }, { status: 502 });
  }

  const callback = new URL("/auth/callback", rootOrigin(host));
  callback.searchParams.set("token_hash", data.properties.hashed_token);
  callback.searchParams.set("type", "magiclink");
  callback.searchParams.set("next", `${tenantOrigin(tenant.slug, host)}/panel`);

  await logAudit("tenant.impersonated", tenantId, admin.id, { owner_id: owner.userId, owner_email: owner.email });
  return NextResponse.json({ url: callback.toString() });
}

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { logAudit } from "@/lib/admin-status";
import { resetDemoData } from "@/lib/demo";
import { listDemoTenantsForAdmin } from "@/lib/admin-tenants";

/** Botón "Resetear demo" del admin (docs/DEMO.md §3), misma lógica que el cron nocturno. */
export async function POST() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const result = await resetDemoData();
  if (!result.ok) {
    console.error("reset-demo (admin) falló", result.error);
    return NextResponse.json({ error: "No se pudo resetear la demo." }, { status: 500 });
  }

  await logAudit("demo.reset", null, admin.id, {});
  const tenants = await listDemoTenantsForAdmin();
  return NextResponse.json({ tenants });
}

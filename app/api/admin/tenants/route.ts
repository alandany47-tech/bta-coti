import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { listTenantsForAdmin } from "@/lib/admin-tenants";

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

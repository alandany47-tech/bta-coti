import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";

/** "Saltar por ahora" del wizard de bienvenida (T23). `settings` no es un dato público cacheado. */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "viewer");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const { error } = await supabase.rpc("dismiss_onboarding", { p_tenant: tenant.id });
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

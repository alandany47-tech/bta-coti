import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { validatePlanInput } from "@/lib/admin-plans";
import { logAudit } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Edición de un plan (docs/ADMIN-PANEL.md §2): incluye `public` — así se "borra" un plan con
 * clientes, nunca con DELETE real.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { planId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = validatePlanInput(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("plans").select("id").eq("code", parsed.value.code).neq("id", planId).maybeSingle();
  if (existing) return NextResponse.json({ error: "Ya existe otro plan con ese código." }, { status: 409 });

  const { data: plan, error } = await supabase.from("plans").update(parsed.value).eq("id", planId).select("*").single();
  if (error || !plan) return NextResponse.json({ error: "No se pudo actualizar el plan." }, { status: 500 });

  await logAudit("plan.updated", null, admin.id, { code: plan.code, changes: parsed.value });
  return NextResponse.json({ plan });
}

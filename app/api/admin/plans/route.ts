import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { validatePlanInput } from "@/lib/admin-plans";
import { logAudit } from "@/lib/admin-status";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** "Nuevo plan" (docs/ADMIN-PANEL.md §2, sección Planes). */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = validatePlanInput(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("plans").select("id").eq("code", parsed.value.code).maybeSingle();
  if (existing) return NextResponse.json({ error: "Ya existe un plan con ese código." }, { status: 409 });

  const { data: plan, error } = await supabase.from("plans").insert(parsed.value).select("*").single();
  if (error || !plan) return NextResponse.json({ error: "No se pudo crear el plan." }, { status: 500 });

  await logAudit("plan.created", null, admin.id, { code: plan.code });
  return NextResponse.json({ plan }, { status: 201 });
}

import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { TenantStatus } from "@/lib/types";

const VALID_STATUSES: TenantStatus[] = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { tenantId } = await params;
  const body = await request.json();

  const updates: { status?: TenantStatus; notes?: string | null } = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    updates.status = body.status;
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes === null ? null : String(body.notes).slice(0, 5000);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: tenant, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select()
    .maybeSingle();

  if (error || !tenant) {
    return NextResponse.json(
      { error: "No se pudo actualizar el tenant." },
      { status: 500 },
    );
  }

  return NextResponse.json({ tenant });
}

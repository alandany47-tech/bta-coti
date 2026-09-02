import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { PropertyImportRow } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const body = (await request.json()) as { rows?: PropertyImportRow[] };

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "El archivo no tiene filas válidas para importar." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  const rows = body.rows
    .filter((row) => row.unit_number?.trim() && row.title?.trim())
    .map((row) => {
      const m2Interior = Math.max(0, Number(row.m2_interior) || 0);
      const m2Exterior = Math.max(0, Number(row.m2_exterior) || 0);
      const m2Total = Number(row.m2_total) || m2Interior + m2Exterior;

      return {
        tenant_id: tenant.id,
        unit_number: row.unit_number.trim(),
        title: row.title.trim(),
        m2_interior: m2Interior,
        m2_exterior: m2Exterior,
        m2_total: Math.max(0, m2Total),
        parking_spaces: Math.max(0, Math.floor(Number(row.parking_spaces)) || 0),
        list_price: Math.max(0, Number(row.list_price) || 0),
      };
    });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Ninguna fila tiene Unidad y Título válidos." },
      { status: 400 },
    );
  }

  const { error: upsertError, count } = await supabase
    .from("properties")
    .upsert(rows, { onConflict: "tenant_id,unit_number", count: "exact" });

  if (upsertError) {
    return NextResponse.json(
      { error: `No se pudo importar la cartera: ${upsertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ imported: count ?? rows.length });
}

import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { MAX_IMPORT_ROWS } from "@/lib/import-properties";
import { importRowToItem } from "@/lib/items";
import type { PropertyImportRow } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const body = (await request.json()) as { rows?: PropertyImportRow[] };

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json(
      { error: "El archivo no tiene filas válidas para importar." },
      { status: 400 },
    );
  }

  if (body.rows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ error: `Máximo ${MAX_IMPORT_ROWS} filas por importación.` }, { status: 400 });
  }

  const rows = body.rows
    .filter((row) => row.unit_number?.trim() && row.title?.trim())
    .map((row) => importRowToItem(tenant.id, row));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Ninguna fila tiene Unidad y Título válidos." },
      { status: 400 },
    );
  }

  const { error: upsertError, count } = await supabase
    .from("items")
    .upsert(rows, { onConflict: "tenant_id,sku", count: "exact" });

  if (upsertError) {
    return NextResponse.json(
      { error: `No se pudo importar la cartera: ${upsertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ imported: count ?? rows.length });
}

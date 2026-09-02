import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ProductImportRow } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const body = (await request.json()) as { rows?: ProductImportRow[] };

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
    .filter((row) => row.sku?.trim() && row.name?.trim())
    .map((row) => ({
      tenant_id: tenant.id,
      sku: row.sku.trim(),
      name: row.name.trim(),
      description: row.description?.trim() || null,
      price: Math.max(0, Number(row.price) || 0),
      category: row.category?.trim() || null,
    }));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Ninguna fila tiene SKU y Nombre válidos." },
      { status: 400 },
    );
  }

  const { error: upsertError, count } = await supabase
    .from("products")
    .upsert(rows, { onConflict: "tenant_id,sku", count: "exact" });

  if (upsertError) {
    return NextResponse.json(
      { error: `No se pudo importar el catálogo: ${upsertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ imported: count ?? rows.length });
}

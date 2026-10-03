import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { CATALOG_COLUMNS, getAllowedKinds, itemErrorResponse } from "@/lib/catalog-admin";
import { parseItemInput } from "@/lib/item-input";

/** Alta de un producto o servicio (T32). RLS (`items_editor_write`) y el tope del plan en BD son la barrera real. */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  // La sesión del editor demo es compartida y la vitrina de la demo es pública: nada de altas.
  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo no se pueden agregar ítems." }, { status: 403 });
  }

  const parsed = parseItemInput(await request.json().catch(() => null), {
    allowedKinds: await getAllowedKinds(supabase, tenant.id),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from("items")
    .insert({ ...parsed.value, tenant_id: tenant.id })
    .select(CATALOG_COLUMNS)
    .single();
  if (error) {
    const failure = itemErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** clients tiene PII: nunca se lee/escribe desde el cliente con la anon key. */
async function resolveActiveTenant(
  supabase: ReturnType<typeof createServiceRoleClient>,
  slug: string,
) {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  return tenant;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const { searchParams } = new URL(request.url);
  // Se quitan % y _ en vez de intentar escaparlos: PostgREST no expone un
  // ESCAPE custom para ilike vía .or(), y estos caracteres no son útiles en
  // nombres/teléfonos reales.
  const q = (searchParams.get("q") ?? "").trim().replace(/[%_]/g, "");

  const supabase = createServiceRoleClient();
  const tenant = await resolveActiveTenant(supabase, slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  let query = supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("full_name", { ascending: true })
    .limit(8);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: clients, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "No se pudo buscar clientes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ clients: clients ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const body = await request.json();

  const fullName = String(body.fullName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;

  if (!fullName || !phone) {
    return NextResponse.json(
      { error: "Nombre y teléfono son obligatorios." },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();
  const tenant = await resolveActiveTenant(supabase, slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado." }, { status: 404 });
  }

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ tenant_id: tenant.id, full_name: fullName, phone, email })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `No se pudo crear el cliente: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ client });
}

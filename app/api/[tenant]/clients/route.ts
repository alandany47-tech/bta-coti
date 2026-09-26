import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";

/** clients tiene PII: solo miembros del tenant, con sesión y RLS. */

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

  const access = await requireTenantAccess(slug, "viewer");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

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
  const access = await requireTenantAccess(slug, "viewer");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

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

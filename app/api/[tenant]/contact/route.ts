import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { normalizeWhatsapp } from "@/lib/catalog";
import { tenantTag } from "@/lib/tenants";

/** WhatsApp del negocio (T28): el que usan "Consultar" y "Enviar mi cotización" de la vitrina pública. */
export async function PATCH(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  // La sesión del editor demo la comparten todos los visitantes: un número guardado aquí
  // quedaría público en la vitrina de la demo hasta el reset nocturno.
  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo no se puede cambiar el WhatsApp." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = typeof body.whatsapp === "string" ? body.whatsapp.trim() : "";
  const digits = raw === "" ? "" : normalizeWhatsapp(raw);
  if (digits === null) {
    return NextResponse.json(
      { error: "Número inválido: escribe 10 dígitos (con lada) o el número completo con código de país." },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("update_tenant_whatsapp", { p_tenant: tenant.id, p_whatsapp: digits });
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar el número." }, { status: 500 });
  }
  revalidateTag(tenantTag(slug), { expire: 0 });

  return NextResponse.json({ whatsapp: digits === "" ? null : digits });
}

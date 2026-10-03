import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isQuoteTemplateCode } from "@/lib/quote-templates";
import { tenantTag } from "@/lib/tenants";

/** Plantilla de cotización del negocio (T31). El tope del plan lo impone la RPC `set_quote_template` (0034). */
export async function PATCH(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  // La sesión del editor demo la comparten todos los visitantes: la elección no se guarda.
  if (tenant.is_demo) {
    return NextResponse.json({ error: "En la demo puedes probar las plantillas, pero no guardar la elección." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  if (!isQuoteTemplateCode(body?.code)) return NextResponse.json({ error: "Plantilla inválida." }, { status: 400 });

  const { error } = await supabase.rpc("set_quote_template", { p_tenant: tenant.id, p_code: body.code });
  if (error) {
    if (error.message.includes("template_not_in_plan")) {
      return NextResponse.json({ error: "Tu plan no incluye esa plantilla." }, { status: 403 });
    }
    return NextResponse.json({ error: "No se pudo guardar la plantilla." }, { status: 500 });
  }
  revalidateTag(tenantTag(slug), { expire: 0 });
  return NextResponse.json({ code: body.code });
}

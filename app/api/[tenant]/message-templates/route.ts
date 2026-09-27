import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { isMessageModule, validateTemplateBody } from "@/lib/message-templates";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const raw = (await request.json().catch(() => null)) as { module?: unknown; body?: unknown } | null;
  if (!isMessageModule(raw?.module)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const validated = validateTemplateBody(raw?.body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { data, error } = await supabase
    .from("message_templates")
    .update({ body: validated.value })
    .eq("tenant_id", tenant.id)
    .eq("module", raw!.module)
    .select("module, body")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ese módulo no está en tu plan." }, { status: 404 });

  return NextResponse.json({ template: data });
}

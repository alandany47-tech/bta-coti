import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/api";
import { tenantTag } from "@/lib/tenants";
import type { PublicTenant } from "@/lib/types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Paso 1 del onboarding (T23): cambiar el color de marca. El logo va por /api/media/*. */
export async function PATCH(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await requireTenantAccess(slug, "editor");
  if (access instanceof NextResponse) return access;
  const { supabase, tenant } = access;

  const body = await request.json().catch(() => ({}));
  const brandColor = typeof body.brandColor === "string" ? body.brandColor : "";
  if (!HEX_RE.test(brandColor)) {
    return NextResponse.json({ error: "Color inválido: usa un hex de 6 dígitos." }, { status: 400 });
  }

  const { error } = await supabase.rpc("update_tenant_branding", { p_tenant: tenant.id, p_brand_color: brandColor });
  if (error) {
    return NextResponse.json({ error: "No se pudo guardar el color." }, { status: 500 });
  }
  revalidateTag(tenantTag(slug), { expire: 0 });

  return NextResponse.json({ tenant: { ...tenant, brand_color: brandColor } satisfies PublicTenant });
}

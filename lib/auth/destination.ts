import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeNext, tenantOrigin } from "@/lib/auth/redirects";

export type Membership = { slug: string; name: string; role: string };

export async function listMemberships(supabase: SupabaseClient): Promise<Membership[]> {
  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenants(slug, name)");
  const rows = (data ?? []) as unknown as {
    role: string;
    tenants: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }[];
  return rows.flatMap((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return tenant ? [{ slug: tenant.slug, name: tenant.name, role: row.role }] : [];
  });
}

/** Destino tras iniciar sesión: ruta relativa (raíz) o URL absoluta (panel del tenant). */
export async function resolveDestination(
  supabase: SupabaseClient,
  host: string,
  next?: string | null,
): Promise<string> {
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  const requested = safeNext(next, host);

  if (isAdmin) return requested ?? "/admin";

  const memberships = await listMemberships(supabase);
  if (memberships.length === 0) return "/login?error=sin_tenant";

  if (requested) {
    const isRootPath = requested.startsWith("/") && !requested.startsWith("/admin");
    const inOwnTenant = memberships.some((m) => requested.startsWith(`${tenantOrigin(m.slug, host)}/`));
    if (isRootPath || inOwnTenant) return requested;
  }

  if (memberships.length === 1) return `${tenantOrigin(memberships[0].slug, host)}/panel`;
  return "/login/elegir";
}

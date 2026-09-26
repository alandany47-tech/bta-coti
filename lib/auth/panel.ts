import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { requireOperableTenant } from "@/lib/tenant-page";
import { rootOrigin, tenantOrigin } from "@/lib/auth/redirects";
import type { TenantRole } from "@/lib/auth/api";
import type { PublicTenant } from "@/lib/types";

export type PanelContext = {
  supabase: SupabaseClient;
  tenant: PublicTenant;
  user: User;
  role: TenantRole;
};

const RANK: Record<TenantRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** Sesión + membresía del panel: sin sesión va al login; sin membresía, 404. */
export const getPanelContext = cache(async (slug: string): Promise<PanelContext> => {
  const supabase = await createSessionSupabaseClient();
  const host = (await headers()).get("host") ?? "";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `${tenantOrigin(slug, host)}/panel`;
    redirect(`${rootOrigin(host)}/login?next=${encodeURIComponent(next)}`);
  }

  const tenant = await requireOperableTenant(slug);

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) notFound();

  return { supabase, tenant, user, role: membership.role as TenantRole };
});

export function hasRole(role: TenantRole, minRole: TenantRole) {
  return RANK[role] >= RANK[minRole];
}

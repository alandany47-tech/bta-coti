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

/**
 * Sesión + membresía del panel: sin sesión va al login; sin membresía, 404.
 * `anyStatus`: ver requireOperableTenant (lib/tenant-page.ts) — solo lo usa /panel/facturacion, y
 * el layout debe llamarla con el mismo valor exacto para esa ruta (`React.cache` compara por
 * argumento con `Object.is`: un booleano, no un objeto nuevo en cada llamada, para que layout y
 * página compartan la misma consulta en vez de duplicarla).
 */
export const getPanelContext = cache(async (slug: string, anyStatus = false): Promise<PanelContext> => {
  const supabase = await createSessionSupabaseClient();
  const h = await headers();
  const host = h.get("host") ?? "";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const path = h.get("x-tenant-pathname") || "/panel";
    const next = `${tenantOrigin(slug, host)}${path}`;
    redirect(`${rootOrigin(host)}/login?next=${encodeURIComponent(next)}`);
  }

  const tenant = await requireOperableTenant(slug, { anyStatus });

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

/**
 * Módulos del plan del tenant (`broker`, `services`, `catalog`) para armar el menú y decidir la
 * página de inicio del panel. Una sola RPC por petición (`React.cache`).
 */
export const getPanelModules = cache(async (tenantId: string): Promise<string[]> => {
  const supabase = await createSessionSupabaseClient();
  const { data } = await supabase.rpc("tenant_modules", { p_tenant: tenantId });
  return Array.isArray(data) ? (data as string[]) : [];
});

/** Páginas de cotizaciones (lista, plantillas): las tiene quien cotiza propiedades (`broker`) o servicios (`services`). */
export async function requireQuotingModule(tenantId: string) {
  const modules = await getPanelModules(tenantId);
  if (!modules.includes("broker") && !modules.includes("services")) redirect("/panel");
}

/** Las páginas de brokers (cotizador, cotizaciones, propiedades, importar) mandan al catálogo si el plan no incluye `broker`. */
export async function requireBrokerModule(tenantId: string) {
  if (!(await getPanelModules(tenantId)).includes("broker")) redirect("/panel/catalogo");
}

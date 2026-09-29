import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getTenantAnyStatus, getTenantBySlug } from "@/lib/tenants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { PublicTenant } from "@/lib/types";

export type TenantRole = "viewer" | "editor" | "owner";

export type TenantAccess = {
  supabase: SupabaseClient;
  tenant: PublicTenant;
  user: User;
};

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

/**
 * Puerta de las rutas /api/<tenant>/*: sesión + membresía con el rol mínimo.
 * Devuelve la respuesta de error lista para retornar, o el cliente de sesión
 * (RLS sigue siendo la segunda barrera).
 *
 * `anyStatus`: para las rutas de facturación (`app/api/[tenant]/billing/*`) — un tenant
 * `suspended`/`canceled` es precisamente el que necesita pagar para reactivarse, así que no puede
 * quedar bloqueado detrás del filtro de estados operables que usa el resto de `/api/[tenant]/*`.
 */
export async function requireTenantAccess(
  slug: string,
  minRole: TenantRole,
  opts: { anyStatus?: boolean } = {},
): Promise<TenantAccess | NextResponse> {
  const limit = await checkRateLimit("api", getClientIp(await headers()));
  if (!limit.ok) {
    const response = fail(429, "Demasiadas solicitudes. Espera un momento.");
    response.headers.set("Retry-After", String(limit.retryAfter));
    return response;
  }

  const supabase = await createSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "Inicia sesión para continuar.");

  const tenant = opts.anyStatus ? await getTenantAnyStatus(slug) : await getTenantBySlug(slug);
  if (!tenant) return fail(404, "Tenant no encontrado.");

  const { data: allowed } = await supabase.rpc("is_member", {
    p_tenant_id: tenant.id,
    p_min_role: minRole,
  });
  if (!allowed) return fail(403, "No tienes permiso para esta acción.");

  return { supabase, tenant, user };
}

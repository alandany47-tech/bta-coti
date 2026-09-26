import "server-only";
import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicTenant } from "@/lib/types";

/**
 * Estados en los que un tenant debe operar con normalidad (storefront +
 * cotizador visibles). 'trialing' cuenta como "vivo" para que el self-serve
 * pueda demostrar valor antes de la primera cobranza; past_due/canceled caen
 * al mismo 404 que un tenant inexistente, y 'suspended' se corta antes, en
 * proxy.ts, con la pantalla de bloqueo.
 */
export const OPERABLE_TENANT_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Columnas seguras para la anon key. notes/stripe_* están recortadas por
 * GRANT a nivel de columna en la migración 0003 (son datos internos del
 * admin), así que un `select("*")` con la anon key fallaría con "permission
 * denied for column" — hay que listarlas explícitamente.
 */
const PUBLIC_TENANT_COLUMNS =
  "id, name, slug, logo_url, brand_color, status, trial_ends_at, created_at";

/** TTL de respaldo: la invalidación real es por tag (`revalidateTag`) al cambiar el tenant. */
const TENANT_CACHE_SECONDS = 300;

export const tenantTag = (slug: string) => `tenant:${slug}`;

/**
 * Tenant por slug en cualquier estado, cacheado con el tag `tenant:<slug>`.
 * Todo cambio de estado, nombre o alta debe llamar `revalidateTag(tenantTag(slug), "max")`
 * (`setTenantStatus`, provisión). También cachea el "no existe" (null).
 */
export async function getTenantAnyStatus(slug: string): Promise<PublicTenant | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await createServerSupabaseClient()
        .from("tenants")
        .select(PUBLIC_TENANT_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(`tenant lookup falló: ${error.message}`);
      return (data as PublicTenant | null) ?? null;
    },
    ["tenant", slug],
    { tags: [tenantTag(slug)], revalidate: TENANT_CACHE_SECONDS },
  )();
}

/** Resuelve un tenant operable por slug; null si no existe o no está operable (suspended/canceled). */
export async function getTenantBySlug(slug: string): Promise<PublicTenant | null> {
  const tenant = await getTenantAnyStatus(slug);
  if (!tenant) return null;
  return (OPERABLE_TENANT_STATUSES as readonly string[]).includes(tenant.status) ? tenant : null;
}

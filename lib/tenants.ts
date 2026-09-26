import "server-only";
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

/** Resuelve un tenant operable (activo o en trial) por slug. Devuelve null si no existe o no está operable. */
export async function getTenantBySlug(slug: string): Promise<PublicTenant | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("tenants")
    .select(PUBLIC_TENANT_COLUMNS)
    .eq("slug", slug)
    .in("status", OPERABLE_TENANT_STATUSES)
    .maybeSingle();

  if (error || !data) return null;
  return data as PublicTenant;
}

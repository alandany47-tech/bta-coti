import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types";

/** Resuelve un tenant activo por slug. Devuelve null si no existe o está inactivo. */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;
  return data as Tenant;
}

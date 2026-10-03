import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allowedKindsForModules, type CatalogKind } from "@/lib/item-input";

export type { CatalogRow } from "@/lib/item-input";

/** Columnas de `items` que usa el panel de catálogo (productos y servicios). */
export const CATALOG_COLUMNS =
  "id, kind, title, sku, description, price, unit, category, attrs, status, images, created_at";


/** Módulos del plan del tenant (`services`, `catalog`, `broker`); vacío si la RPC falla. */
export async function getTenantModules(supabase: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data } = await supabase.rpc("tenant_modules", { p_tenant: tenantId });
  return Array.isArray(data) ? (data as string[]) : [];
}

export async function getAllowedKinds(supabase: SupabaseClient, tenantId: string): Promise<CatalogKind[]> {
  return allowedKindsForModules(await getTenantModules(supabase, tenantId));
}

/** Traduce los errores de la BD (cuota del plan, SKU duplicado) a un mensaje para el negocio. */
export function itemErrorResponse(error: { code?: string; message?: string }): { status: number; error: string } {
  if (error.message?.includes("item_quota_exceeded")) {
    return { status: 409, error: "Llegaste al límite de ítems de tu plan. Cambia de plan para agregar más." };
  }
  if (error.code === "23505") return { status: 409, error: "Ya tienes un ítem con ese código." };
  return { status: 500, error: "No se pudo guardar el ítem." };
}

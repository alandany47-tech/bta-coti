import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * RPC públicas (`slug_available`, `get_shared_quote`, `get_quote_tenant_slug`) llamadas desde el
 * servidor de Next.js. Van con service role a propósito: la base limita por IP a quien las llama
 * directo por REST con la anon key (0019), pero desde Vercel la IP que ve Supabase es la de salida
 * de Vercel, así que todos los visitantes compartirían ese cupo. Con service role la base las deja
 * pasar sin su límite (0021) y el límite por visitante lo pone Upstash en la ruta que llama
 * (`checkRateLimit`) ANTES de llegar aquí. Este archivo solo expone estas tres funciones: no lo
 * uses como puerta trasera para otras consultas con service role.
 */

export async function slugAvailable(slug: string): Promise<{ available: boolean; error: boolean }> {
  const { data, error } = await createServiceRoleClient().rpc("slug_available", { p_slug: slug });
  return { available: data === true, error: Boolean(error) };
}

export type SharedQuoteRow = {
  snapshot: unknown;
  number: number | null;
  status: string;
  expires_at: string;
  expired: boolean;
  views: number;
  tenant_slug: string;
  tenant_name: string;
  tenant_logo_url: string | null;
  brand_color: string | null;
};

export async function getSharedQuote(token: string): Promise<SharedQuoteRow | null> {
  const { data, error } = await createServiceRoleClient().rpc("get_shared_quote", { p_token: token });
  if (error) console.error("get_shared_quote falló", error.message);
  return (data?.[0] as SharedQuoteRow | undefined) ?? null;
}

export async function getQuoteTenantSlug(token: string): Promise<string | null> {
  const { data, error } = await createServiceRoleClient().rpc("get_quote_tenant_slug", { p_token: token });
  if (error) console.error("get_quote_tenant_slug falló", error.message);
  return typeof data === "string" && data ? data : null;
}

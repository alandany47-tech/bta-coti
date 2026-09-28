import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { tenantOrigin } from "@/lib/auth/redirects";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Los enlaces siempre se generan en el subdominio del tenant (docs/PLAN-MAESTRO.md §5); esta
 * ruta en el dominio raíz solo existe por si alguien pega el link sin el subdominio.
 */
export default async function RootSharedQuoteRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();

  // Upstash con la IP real: la RPC se llama con service role (ver supabase/migrations/0024) y su
  // propio respaldo por IP se salta a sí mismo con esa llave, así que este es el único límite acá.
  const limit = await checkRateLimit("share", getClientIp(h));
  if (!limit.ok) notFound();

  const { data: slug } = await createServiceRoleClient().rpc("get_quote_tenant_slug", { p_token: token });
  if (!slug) notFound();

  const host = h.get("host") ?? "";
  redirect(`${tenantOrigin(slug, host)}/q/${token}`);
}

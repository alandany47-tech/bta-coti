import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { tenantOrigin } from "@/lib/auth/redirects";
import { getClientIp } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Los enlaces siempre se generan en el subdominio del tenant (docs/PLAN-MAESTRO.md §5); esta
 * ruta en el dominio raíz solo existe por si alguien pega el link sin el subdominio.
 */
export default async function RootSharedQuoteRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const { data: slug } = await createServerSupabaseClient().rpc("get_quote_tenant_slug", {
    p_token: token,
    p_ip: getClientIp(h),
  });
  if (!slug) notFound();

  const host = h.get("host") ?? "";
  redirect(`${tenantOrigin(slug, host)}/q/${token}`);
}

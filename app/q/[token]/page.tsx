import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { tenantOrigin } from "@/lib/auth/redirects";
import { getQuoteTenantSlug } from "@/lib/public-rpc";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Los enlaces siempre se generan en el subdominio del tenant (docs/PLAN-MAESTRO.md §5); esta
 * ruta en el dominio raíz solo existe por si alguien pega el link sin el subdominio.
 */
export default async function RootSharedQuoteRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const limit = await checkRateLimit("share", getClientIp(h));
  if (!limit.ok) {
    return <p className="p-8 text-center text-ink-2">Demasiadas solicitudes. Intenta de nuevo en un momento.</p>;
  }

  const slug = await getQuoteTenantSlug(token);
  if (!slug) notFound();

  const host = h.get("host") ?? "";
  redirect(`${tenantOrigin(slug, host)}/q/${token}`);
}

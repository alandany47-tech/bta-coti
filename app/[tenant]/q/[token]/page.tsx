import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { QuoteView } from "@/components/quote/quote-view";
import { tenantOrigin } from "@/lib/auth/redirects";
import { parseQuoteSnapshot } from "@/lib/quote-snapshot";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cotización",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

export default async function SharedQuotePage({
  params,
}: {
  params: Promise<{ tenant: string; token: string }>;
}) {
  const { tenant: slug, token } = await params;
  const h = await headers();
  const host = h.get("host") ?? "";
  const ip = getClientIp(h);
  const limit = await checkRateLimit("share", ip);
  if (!limit.ok) {
    return <p className="p-8 text-center text-ink-2">Demasiadas solicitudes. Intenta de nuevo en un momento.</p>;
  }

  // Service role a propósito: Upstash (arriba) ya limita por IP real; el límite en la base es
  // solo el respaldo para quien se salte la app, y se salta a sí mismo con la llave de servicio.
  const { data } = await createServiceRoleClient().rpc("get_shared_quote", { p_token: token });
  const row = data?.[0];
  if (!row) notFound();

  // El token es global: si alguien entra por el subdominio de otro tenant, lo mandamos al suyo.
  if (row.tenant_slug !== slug) {
    redirect(`${tenantOrigin(row.tenant_slug, host)}/q/${token}`);
  }

  if (row.expired) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-3xl">Esta cotización venció</h1>
        <p className="text-ink-2">
          Perdió vigencia el {dateFormat.format(new Date(row.expires_at))}. Pídele a {row.tenant_name} que te
          envíe una nueva.
        </p>
      </main>
    );
  }

  const snapshot = parseQuoteSnapshot(row.snapshot);
  if (!snapshot) notFound();

  // Marca, plantilla y montos salen del snapshot congelado (lib/quote-snapshot.ts): si el negocio cambia
  // nombre, logo, color o plantilla después, esta página no debe verse distinta del PDF ya descargado.
  const number = row.number ?? snapshot.number;
  return <QuoteView snapshot={{ ...snapshot, number }} validUntil={dateFormat.format(new Date(row.expires_at))} />;
}

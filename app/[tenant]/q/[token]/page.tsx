import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { DownloadPdfButton } from "@/components/quote/download-pdf-button";
import { tenantOrigin } from "@/lib/auth/redirects";
import { parseQuoteSnapshot } from "@/lib/quote-snapshot";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cotización",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={`tabular text-right font-medium ${muted ? "text-ink-3 line-through" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

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

  const number = row.number ?? snapshot.number;
  const snap = { ...snapshot, number };
  const { property, breakdown } = snap;
  // Congelado a propósito (lib/quote-snapshot.ts): si el tenant cambia nombre/logo/color después,
  // esta página no debe verse distinta del PDF que ya se descargó con la marca de ese momento.
  const accent = snap.brandColor ?? undefined;
  const hasDiscount = breakdown.discountAmount > 0.009;
  const hasFinal = breakdown.finalPaymentAmount > 0.009;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3 border-b-2 pb-4" style={{ borderColor: accent }}>
        {snap.tenantLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={snap.tenantLogoUrl} alt="" className="h-10 w-10 rounded object-contain" />
        ) : null}
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-semibold text-ink">{snap.tenantName}</span>
          <span className="text-xs text-ink-3">
            Cotización {number ? `#${String(number).padStart(4, "0")}` : ""} · {dateFormat.format(new Date(snap.createdAt))}
          </span>
        </div>
      </header>

      <section>
        <p className="text-sm text-ink-2">Preparada para {snap.clientName}</p>
        {property ? (
          <>
            <h1 className="mt-1 text-3xl">{property.title}</h1>
            <p className="text-sm text-ink-2">
              Unidad {property.unit_number} · {property.m2_total} m² · {property.parking_spaces}{" "}
              {property.parking_spaces === 1 ? "cajón" : "cajones"}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Esta cotización ya no tiene una propiedad asociada.</p>
        )}
      </section>

      {property && property.images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {property.images.slice(0, 6).map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading={index < 3 ? "eager" : "lazy"} className="aspect-[4/3] w-full rounded-md object-cover" />
          ))}
        </div>
      ) : null}

      <dl className="rounded-lg border border-line bg-surface px-4">
        {property ? <Row label="Precio de lista" value={formatCurrency(property.list_price)} muted={hasDiscount} /> : null}
        {hasDiscount ? <Row label="Descuento" value={`− ${formatCurrency(breakdown.discountAmount)}`} /> : null}
        <Row label="Precio final" value={formatCurrency(breakdown.effectivePrice)} />
        <Row label="Enganche" value={formatCurrency(breakdown.downPaymentAmount)} />
        <Row
          label={`Mensualidad (${snap.installmentsCount} pagos)`}
          value={formatCurrency(breakdown.monthlyPaymentAmount)}
        />
        {hasFinal ? <Row label="Saldo a escrituración" value={formatCurrency(breakdown.finalPaymentAmount)} /> : null}
      </dl>

      {snap.notes ? <p className="rounded-md bg-sunken p-3 text-sm text-ink-2">{snap.notes}</p> : null}
      {snap.advisorName ? <p className="text-sm text-ink-2">Asesor: {snap.advisorName}</p> : null}
      <p className="text-xs text-ink-3">Vigente hasta el {dateFormat.format(new Date(row.expires_at))}.</p>

      <DownloadPdfButton snapshot={snap} />
    </main>
  );
}

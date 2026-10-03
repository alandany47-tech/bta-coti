import type { CSSProperties } from "react";
import { DownloadPdfButton } from "@/components/quote/download-pdf-button";
import { BRAND } from "@/lib/brand";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import { accentTextColor, getQuoteTemplate, readableOn, safeBrandColor, type QuoteTemplate } from "@/lib/quote-templates";
import { buildQuoteViewModel } from "@/lib/quote-view-model";

const STATUS_COLOR = { ok: "#22C55E", warn: "#F59E0B", danger: "#EF4444" } as const;

/**
 * Cotización en la web (T31): las mismas dos hojas del PDF, con el mismo contenido
 * (`buildQuoteViewModel`) y el mismo aspecto (`lib/quote-templates.ts`). Se usa en la página pública
 * `slug./q/<token>` y en la vista previa de Panel → Plantillas (`withPdf` apagado ahí).
 */
export function QuoteView({
  snapshot,
  validUntil,
  withPdf = true,
}: {
  snapshot: QuoteSnapshot;
  /** Texto de vigencia ya formateado; null en la vista previa. */
  validUntil?: string | null;
  withPdf?: boolean;
}) {
  const t = getQuoteTemplate(snapshot.templateCode);
  const brand = safeBrandColor(snapshot.brandColor);
  const m = buildQuoteViewModel(snapshot, BRAND.name);
  const c = t.colors;
  const onBrand = readableOn(brand);
  const accentText = accentTextColor(brand, c.ink);
  const font = t.font === "serif" ? "var(--font-display)" : "var(--font-sans)";
  const sheet: CSSProperties = { fontFamily: font, background: c.page, color: c.ink, border: `1px solid ${c.line}`, borderRadius: t.radius ? t.radius + 2 : 0 };
  const muted: CSSProperties = { color: c.muted };
  const label: CSSProperties = { ...muted, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" };
  const bandMuted: CSSProperties = { color: onBrand, opacity: 0.8 };

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-3 py-6 sm:px-6 sm:py-10">
      <article style={sheet} className="flex flex-col gap-7 p-5 sm:p-10" aria-label="Cotización">
        {t.header === "centered" ? (
          <header className="flex flex-col items-center gap-1 text-center">
            {m.tenantLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.tenantLogoUrl} alt="" className="mb-2 h-12 w-12 object-contain" />
            ) : null}
            <p className="text-3xl font-semibold tracking-wide sm:text-4xl">{m.tenantName}</p>
            <p style={label}>{m.tagline}</p>
            <p
              style={{ borderTop: `1px solid ${c.ink}`, borderBottom: `1px solid ${c.ink}`, fontSize: 12 }}
              className="mt-3 flex w-full flex-wrap justify-center gap-x-5 gap-y-1 py-2 uppercase tracking-widest"
            >
              <span>Folio {m.folio}</span>
              <span>{m.date}</span>
              {m.advisorName ? <span>Asesor: {m.advisorName}</span> : null}
            </p>
          </header>
        ) : (
          <>
            <header
              style={t.header === "band" ? { background: brand, color: onBrand, borderRadius: t.radius } : undefined}
              className={`flex flex-wrap items-start justify-between gap-4 ${t.header === "band" ? "p-4 sm:p-5" : ""}`}
            >
              <div className="flex items-center gap-3">
                {m.tenantLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.tenantLogoUrl} alt="" className="h-10 w-10 object-contain" />
                ) : null}
                <div className="leading-tight">
                  <p className="text-lg font-semibold sm:text-xl">{m.tenantName}</p>
                  <p style={t.header === "band" ? { ...bandMuted, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" } : label}>{m.tagline}</p>
                </div>
              </div>
              <div className="text-right leading-snug" style={t.header === "band" ? bandMuted : muted}>
                <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>{m.metaTitle}</p>
                <p className="font-semibold" style={t.header === "band" ? { color: onBrand } : { color: c.ink }}>
                  Folio {m.folio}
                </p>
                <p className="text-sm">{m.date}</p>
                {m.advisorName ? <p className="text-sm">Asesor: {m.advisorName}</p> : null}
              </div>
            </header>
            {t.header === "rule" ? <div style={{ height: 2, background: brand }} aria-hidden /> : null}
          </>
        )}

        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={`${t.font === "serif" ? "text-3xl" : "text-2xl"} font-semibold leading-tight sm:text-3xl`} style={{ fontFamily: font }}>
              {m.hero.title}
            </h1>
            <p className="mt-1 text-sm" style={muted}>
              {m.hero.subtitle}
            </p>
          </div>
          {m.hero.status ? (
            <span style={{ background: c.soft, color: c.muted, borderRadius: t.radius === 0 ? 0 : 999, fontSize: 11 }} className="inline-flex items-center gap-1.5 px-3 py-1 uppercase tracking-wider">
              <span style={{ background: STATUS_COLOR[m.hero.status.tone] }} className="h-1.5 w-1.5 rounded-full" aria-hidden />
              {m.hero.status.label}
            </span>
          ) : null}
        </section>

        {m.stats.length > 0 ? (
          <section>
            <h2 style={label} className="mb-2 font-normal">
              Características generales
            </h2>
            <dl
              style={{
                background: c.statsBg,
                color: c.statsInk,
                borderRadius: t.stats === "inline" ? 0 : t.radius,
                ...(t.stats === "panel" ? { border: `1px solid ${c.line}` } : {}),
                ...(t.stats === "inline" ? { borderTop: `1px solid ${c.ink}`, borderBottom: `1px solid ${c.ink}` } : {}),
              }}
              className="grid grid-cols-2 overflow-hidden sm:grid-cols-5"
            >
              {m.stats.map((stat, index) => (
                <div
                  key={stat.label}
                  style={{ borderRight: index === m.stats.length - 1 ? undefined : `1px solid ${t.stats === "dark" ? "#27272A" : c.line}` }}
                  className="px-3 py-3.5 sm:px-3.5"
                >
                  <dt style={{ color: c.statsMuted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{stat.label}</dt>
                  <dd className="tabular mt-1 text-base font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {m.lines.length > 0 ? (
          <section>
            <h2 style={label} className="mb-2 font-normal">
              Conceptos
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead style={{ borderBottom: `1px solid ${c.ink}`, ...muted }}>
                  <tr className="text-[10px] uppercase tracking-wider">
                    <th className="py-2 pr-2 font-normal">Concepto</th>
                    <th className="px-2 py-2 text-right font-normal">Cant.</th>
                    <th className="px-2 py-2 text-right font-normal">Precio</th>
                    <th className="px-2 py-2 text-right font-normal">Desc.</th>
                    <th className="py-2 pl-2 text-right font-normal">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {m.lines.map((line, index) => (
                    <tr key={index} style={{ borderBottom: `1px solid ${c.line}` }}>
                      <td className="py-2.5 pr-2 text-[15px]">{line.title}</td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap">{line.qty}</td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap">{line.unitPrice}</td>
                      <td className="tabular px-2 py-2.5 text-right whitespace-nowrap" style={line.discount ? { color: accentText } : muted}>
                        {line.discount ?? "·"}
                      </td>
                      <td className="tabular py-2.5 pl-2 text-right font-semibold whitespace-nowrap">{line.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section>
          <h2 style={label} className="mb-2 font-normal">
            {m.rowsTitle}
          </h2>
          <dl>
            {m.rows.map((row) => (
              <div key={row.label} style={{ borderBottom: `1px solid ${c.line}` }} className="flex items-baseline justify-between gap-4 py-3">
                <div>
                  <dt className="text-[15px]">{row.label}</dt>
                  {row.sub ? (
                    <p className="text-xs" style={muted}>
                      {row.sub}
                    </p>
                  ) : null}
                </div>
                <dd
                  className="tabular text-right text-[15px] font-semibold"
                  style={row.tone === "muted" ? { ...muted, fontWeight: 400 } : row.tone === "accent" ? { color: accentText } : undefined}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          {t.total === "block" ? (
            <p style={{ background: brand, color: onBrand, borderRadius: t.radius }} className="mt-3 flex items-center justify-between gap-4 px-4 py-4">
              <span className="font-semibold">{m.total.label}</span>
              <span className="tabular text-xl font-semibold sm:text-2xl">{m.total.value}</span>
            </p>
          ) : (
            <p className="mt-4 flex items-center justify-between gap-4 pt-2">
              <span className="font-semibold">{m.total.label}</span>
              <span className="tabular text-xl font-semibold sm:text-2xl" style={{ color: accentText }}>
                {m.total.value}
              </span>
            </p>
          )}
        </section>

        {m.notes ? (
          <p style={{ background: c.soft, borderRadius: t.radius }} className="p-3 text-sm leading-relaxed">
            {m.notes}
          </p>
        ) : null}

        <footer className="text-xs leading-relaxed" style={muted}>
          {validUntil ? <p className="mb-1">Vigente hasta el {validUntil}.</p> : null}
          <p>{m.disclaimer}</p>
        </footer>
      </article>

      {m.hasProperty ? <SecondSheet t={t} m={m} font={font} /> : null}

      {withPdf ? (
        <div className="px-1">
          <DownloadPdfButton snapshot={snapshot} />
        </div>
      ) : null}
    </div>
  );
}

function SecondSheet({ t, m, font }: { t: QuoteTemplate; m: ReturnType<typeof buildQuoteViewModel>; font: string }) {
  const s = t.sheet2;
  const box: CSSProperties = { background: s.cell, border: `1px solid ${s.line}`, borderRadius: t.radius === 0 ? 0 : t.radius + 2 };
  const label: CSSProperties = { color: s.muted, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" };
  return (
    <article
      style={{ fontFamily: font, background: s.page, color: s.ink, border: `1px solid ${s.line}`, borderRadius: t.radius ? t.radius + 2 : 0 }}
      className="flex flex-col gap-6 p-5 sm:p-10"
      aria-label="Plano y galería"
    >
      <header style={{ borderBottom: `1px solid ${s.line}` }} className="flex items-start justify-between gap-4 pb-4">
        <div>
          <p className="text-lg font-semibold">{m.galleryTitle}</p>
          <p className="text-xs" style={{ color: s.muted }}>
            {m.tenantName}
          </p>
        </div>
        <p className="text-xs" style={{ color: s.muted }}>
          Folio {m.folio}
        </p>
      </header>

      <section>
        <h2 style={label} className="mb-2 font-normal">
          Plano de la propiedad
        </h2>
        <div style={box} className="flex h-56 items-center justify-center overflow-hidden">
          {m.floorPlanUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.floorPlanUrl} alt="Plano de la propiedad" className="h-full w-full object-contain" />
          ) : (
            <span className="text-sm" style={{ color: s.muted }}>
              Plano no disponible
            </span>
          )}
        </div>
      </section>

      <section>
        <h2 style={label} className="mb-2 font-normal">
          Galería
        </h2>
        {m.images.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {m.images.map((src, index) => (
              <div key={src} style={box} className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading={index < 3 ? "eager" : "lazy"} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: s.muted }}>
            Sin imágenes cargadas todavía.
          </p>
        )}
      </section>

      <p className="text-center text-xs" style={{ color: s.muted }}>
        {m.sheet2Footer}
      </p>
    </article>
  );
}

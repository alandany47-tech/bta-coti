"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Minus, Plus, Search, Send, X } from "lucide-react";
import { ClientCombobox } from "@/components/cotizador/client-combobox";
import { DemoQuoteResult } from "@/components/cotizador/demo-quote-result";
import { CopyLinkButton } from "@/components/quote/copy-link-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/catalog";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import { MAX_LINES, priceServices, type LineInput } from "@/lib/services-pricing";
import type { Client } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

export type QuoteCatalogItem = { id: string; title: string; price: number; unit: string | null; category: string | null };

type Line = { key: string; itemId: string | null; title: string; unit: string | null; unitPrice: string; qty: string; discount: string };
type Sent = { number: number; quoteUrl: string; whatsappUrl: string; total: number };

const TAX_CHOICES = [
  { label: "Sin IVA", value: 0 },
  { label: "8 %", value: 8 },
  { label: "16 %", value: 16 },
] as const;

/** IVA recordado por negocio en este navegador (útil para quien siempre cotiza con el mismo). Sin servidor: no es un dato del negocio. */
const taxListeners = new Set<() => void>();
const subscribeTax = (cb: () => void) => {
  taxListeners.add(cb);
  return () => void taxListeners.delete(cb);
};
const readTax = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const num = (value: string) => {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const newKey = () => Math.random().toString(36).slice(2, 9);

/**
 * Cotizador de servicios (T30), pensado para armarse con el pulgar: tocar un concepto del catálogo
 * lo agrega (tocarlo otra vez suma 1), cantidad con + / −, descuento por línea, IVA a un toque y
 * totales siempre a la vista. Los montos finales los recalcula el servidor.
 */
export function ServicesQuoteBuilder({
  tenantSlug,
  items,
  isDemo,
  registroUrl,
}: {
  tenantSlug: string;
  items: QuoteCatalogItem[];
  isDemo: boolean;
  registroUrl: string;
}) {
  const [client, setClient] = useState<Client | null>(null);
  const [demoName, setDemoName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [query, setQuery] = useState("");
  const [freeOpen, setFreeOpen] = useState(false);
  const [free, setFree] = useState({ title: "", price: "" });
  const taxKey = `ayxco:tax:${tenantSlug}`;
  const savedTax = useSyncExternalStore(subscribeTax, () => readTax(taxKey), () => null);
  const [taxChoice, setTaxChoice] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const savedTaxNumber = savedTax !== null && savedTax !== "" && Number.isFinite(Number(savedTax)) ? Number(savedTax) : null;
  const taxPct = taxChoice ?? savedTaxNumber ?? 16;
  const customTax = customOpen || !TAX_CHOICES.some((c) => c.value === taxPct);
  const [advisor, setAdvisor] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [demoResult, setDemoResult] = useState<{ snapshot: QuoteSnapshot; whatsappUrl: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent || demoResult) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sent, demoResult]);

  function chooseTax(value: number) {
    setTaxChoice(value);
    try {
      window.localStorage.setItem(taxKey, String(value));
      taxListeners.forEach((cb) => cb());
    } catch {
      // sin almacenamiento: vale solo para esta sesión
    }
  }

  const pricing = useMemo(
    () =>
      priceServices(
        lines.map((l): LineInput => ({ itemId: l.itemId, title: l.title, unit: l.unit, qty: num(l.qty), unitPrice: num(l.unitPrice), discountPct: num(l.discount) })),
        taxPct,
      ),
    [lines, taxPct],
  );

  const matches = useMemo(() => {
    const q = normalizeText(query);
    const pool = q ? items.filter((i) => normalizeText(`${i.title} ${i.category ?? ""}`).includes(q)) : items;
    return pool.slice(0, 60);
  }, [items, query]);

  function addItem(item: QuoteCatalogItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: String(num(l.qty) + 1) } : l));
      if (prev.length >= MAX_LINES) return prev;
      return [...prev, { key: newKey(), itemId: item.id, title: item.title, unit: item.unit, unitPrice: String(item.price), qty: "1", discount: "" }];
    });
    setQuery("");
  }

  function addFree() {
    const title = free.title.trim();
    if (!title) return;
    setLines((prev) => (prev.length >= MAX_LINES ? prev : [...prev, { key: newKey(), itemId: null, title, unit: null, unitPrice: free.price || "0", qty: "1", discount: "" }]));
    setFree({ title: "", price: "" });
    setFreeOpen(false);
  }

  const patch = (key: string, p: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const step = (l: Line, delta: number) => patch(l.key, { qty: String(Math.max(0, Math.round((num(l.qty) + delta) * 1000) / 1000)) });

  const hasClient = isDemo ? demoName.trim().length >= 2 : Boolean(client);
  const validLines = lines.length > 0 && lines.every((l) => num(l.qty) > 0);
  const canSubmit = hasClient && validLines && !busy;

  function reset() {
    setLines([]);
    setClient(null);
    setDemoName("");
    setNotes("");
    setSent(null);
    setDemoResult(null);
    setError(null);
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    // Safari/iOS solo abre pestañas si window.open ocurre dentro del clic (ver cotizador-client.tsx).
    const whatsappTab = isDemo ? null : window.open("", "_blank");
    try {
      const res = await fetch(`/api/${tenantSlug}/quotes/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isDemo ? { clientName: demoName.trim() } : { clientId: client!.id }),
          taxPct,
          advisorName: advisor.trim() || undefined,
          notes: notes.trim() || undefined,
          lines: lines.map((l) => ({
            itemId: l.itemId,
            qty: num(l.qty),
            discountPct: num(l.discount),
            ...(l.itemId ? {} : { title: l.title, unitPrice: num(l.unitPrice), unit: l.unit }),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        whatsappTab?.close();
        setError(data.error ?? "No se pudo generar la cotización.");
        return;
      }
      if (data.demo) {
        setDemoResult({ snapshot: data.snapshot, whatsappUrl: data.whatsappUrl });
        return;
      }
      if (whatsappTab) whatsappTab.location.href = data.whatsappUrl;
      else window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      setSent({ number: data.number, quoteUrl: data.quoteUrl, whatsappUrl: data.whatsappUrl, total: data.total });
    } catch {
      whatsappTab?.close();
      setError("Error de red al generar la cotización.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div ref={resultRef} className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
        <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Cotización #{String(sent.number).padStart(4, "0")}</p>
          <h1 className="text-2xl">Enviada por {formatCurrency(sent.total)}</h1>
          <p className="text-sm text-ink-2">Se abrió WhatsApp con el mensaje y el enlace. Si no se abrió, usa el botón.</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href={sent.whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "secondary" }))}>
              <Send /> Abrir WhatsApp
            </a>
            <a href={sent.quoteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
              Ver cotización
            </a>
            <CopyLinkButton url={sent.quoteUrl} />
          </div>
        </section>
        <Button size="lg" onClick={reset}>
          <Plus /> Nueva cotización
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl">Cotizar servicios</h1>
        <p className="text-sm text-ink-2">Toca los conceptos de tu catálogo para agregarlos. Los montos se calculan solos.</p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">{isDemo ? "Cliente de prueba" : "Cliente"}</h2>
        {isDemo ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="demo-name" className="text-xs font-medium text-muted">
              Nombre
            </label>
            <Input id="demo-name" value={demoName} maxLength={60} autoComplete="off" onChange={(e) => setDemoName(e.target.value)} placeholder="Ej. Laura Hernández" />
            <p className="text-xs text-muted">Con solo el nombre basta. En la demo no se guarda ningún dato.</p>
          </div>
        ) : (
          <ClientCombobox tenantSlug={tenantSlug} selected={client} onSelect={setClient} />
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">Conceptos</h2>
        {items.length > 0 ? (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en tu catálogo" className="h-11 pl-9" aria-label="Buscar en tu catálogo" />
            </div>
            <ul className="flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto" aria-label="Catálogo">
              {matches.map((item) => {
                const added = lines.find((l) => l.itemId === item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-line bg-paper px-3 text-left text-sm transition-colors hover:border-line-strong"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} aria-hidden />
                      <span>
                        <span className="block leading-tight">{item.title}</span>
                        <span className="tabular block text-xs text-ink-3">
                          {item.price > 0 ? formatCurrency(item.price) : "A cotizar"}
                          {item.unit ? ` / ${item.unit}` : ""}
                        </span>
                      </span>
                      {added ? <span className="tabular rounded-full bg-accent-soft px-2 text-xs text-accent">×{added.qty}</span> : null}
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 ? <li className="text-sm text-ink-3">Nada coincide. Agrégalo como concepto libre.</li> : null}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-2">Tu catálogo está vacío: agrega conceptos libres aquí o carga tus servicios en Catálogo.</p>
        )}

        {freeOpen ? (
          <div className="grid gap-2 rounded-md border border-dashed border-line-strong p-3 sm:grid-cols-[1fr_9rem_auto]">
            <Input value={free.title} onChange={(e) => setFree((f) => ({ ...f, title: e.target.value }))} maxLength={120} placeholder="Concepto" aria-label="Nombre del concepto libre" />
            <Input value={free.price} onChange={(e) => setFree((f) => ({ ...f, price: e.target.value }))} inputMode="decimal" placeholder="Precio" aria-label="Precio del concepto libre" />
            <div className="flex gap-2">
              <Button type="button" onClick={addFree} disabled={!free.title.trim()}>
                Agregar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFreeOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setFreeOpen(true)} className="flex h-10 w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            <Plus className="h-4 w-4" strokeWidth={1.5} /> Concepto libre
          </button>
        )}
      </section>

      {lines.length > 0 ? (
        <section aria-label="Líneas de la cotización" className="flex flex-col gap-2">
          {pricing.lines.map((priced, index) => {
            const l = lines[index];
            return (
              <div key={l.key} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3" data-testid="line">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug">{l.title}</p>
                    {l.itemId ? (
                      <p className="tabular text-xs text-ink-3">
                        {formatCurrency(priced.unitPrice)}
                        {l.unit ? ` / ${l.unit}` : ""}
                      </p>
                    ) : (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-3">
                        Precio
                        <Input value={l.unitPrice} onChange={(e) => patch(l.key, { unitPrice: e.target.value })} inputMode="decimal" className="h-8 w-28 px-2 text-sm" aria-label={`Precio de ${l.title}`} />
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} aria-label={`Quitar ${l.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-3 hover:text-danger">
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1" role="group" aria-label={`Cantidad de ${l.title}`}>
                    <button type="button" onClick={() => step(l, -1)} aria-label="Menos" className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper">
                      <Minus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <Input value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} inputMode="decimal" className="h-11 w-16 px-1 text-center" aria-label="Cantidad" />
                    <button type="button" onClick={() => step(l, 1)} aria-label="Más" className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-paper">
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-ink-3">
                    Desc.
                    <Input value={l.discount} onChange={(e) => patch(l.key, { discount: e.target.value })} inputMode="decimal" placeholder="0" className="h-11 w-16 px-2 text-center text-sm" aria-label={`Descuento de ${l.title}`} />%
                  </label>
                  <p className="tabular ml-auto text-right text-[15px] font-semibold" data-testid="line-total">
                    {formatCurrency(priced.total)}
                  </p>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">IVA</h2>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="IVA">
          {TAX_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={!customTax && taxPct === c.value}
              onClick={() => {
                setCustomOpen(false);
                chooseTax(c.value);
              }}
              className={cn("h-11 rounded-md border px-4 text-sm", !customTax && taxPct === c.value ? "border-ink bg-ink text-paper" : "border-line bg-paper")}
            >
              {c.label}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={customTax} onClick={() => setCustomOpen(true)} className={cn("h-11 rounded-md border px-4 text-sm", customTax ? "border-ink bg-ink text-paper" : "border-line bg-paper")}>
            Otro
          </button>
          {customTax ? (
            <label className="flex items-center gap-1.5 text-sm">
              <Input value={String(taxPct)} onChange={(e) => chooseTax(Math.min(100, Math.max(0, num(e.target.value))))} inputMode="decimal" className="h-11 w-20 px-2 text-center" aria-label="Porcentaje de IVA" />%
            </label>
          ) : null}
        </div>
        <p className="text-xs text-ink-3">Los precios de tu catálogo se toman sin IVA; el IVA se suma al final.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Quién cotiza (opcional)
          <Input value={advisor} onChange={(e) => setAdvisor(e.target.value)} placeholder="Tu nombre" className="text-sm font-normal text-foreground" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Notas para el cliente (opcional)
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Vigencia, anticipo, tiempos…" className="text-sm font-normal text-foreground" />
        </label>
      </section>

      {demoResult ? (
        <div ref={resultRef}>
          <DemoQuoteResult snapshot={demoResult.snapshot} whatsappUrl={demoResult.whatsappUrl} registroUrl={registroUrl} onReset={reset} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 mt-auto flex items-center justify-between gap-3 border-t border-line bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0">
        <div className="min-w-0 leading-tight">
          <p className="tabular text-xs text-ink-3">
            {lines.length} {lines.length === 1 ? "concepto" : "conceptos"}
            {pricing.taxPct > 0 ? ` · IVA ${formatCurrency(pricing.taxAmount)}` : ""}
          </p>
          <p className="tabular text-2xl font-semibold" data-testid="grand-total">
            {formatCurrency(pricing.total)}
          </p>
        </div>
        <Button size="lg" disabled={!canSubmit} onClick={submit}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          {isDemo ? "Probar cotización" : "Enviar por WhatsApp"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { MessageCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/quote/download-pdf-button";
import { cn, formatCurrency } from "@/lib/utils";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

/**
 * Resultado de una cotización de prueba (tenants de demo): se arma sin guardar nada, así que
 * no hay enlace público; el PDF se genera aquí mismo en el navegador a partir del snapshot que
 * devolvió el servidor (montos ya recalculados).
 */
export function DemoQuoteResult({
  snapshot,
  whatsappUrl,
  registroUrl,
  onReset,
}: {
  snapshot: QuoteSnapshot;
  whatsappUrl: string;
  registroUrl: string;
  onReset: () => void;
}) {
  const { breakdown, property } = snapshot;

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-4 sm:p-6"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Cotización de prueba</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Lista para {snapshot.clientName}</h2>
        <p className="mt-1 text-sm text-muted">
          No se guardó nada: ni el cliente ni la cotización. Descárgala o mándala por WhatsApp para ver
          cómo le llegaría a tu cliente.
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {property ? (
          <div className="flex justify-between gap-4 sm:col-span-2">
            <dt className="text-muted">Propiedad</dt>
            <dd className="text-right text-foreground">
              {property.title} · {property.unit_number}
            </dd>
          </div>
        ) : null}
        {snapshot.kind === "services" && snapshot.services ? (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Conceptos</dt>
              <dd className="text-foreground">{snapshot.services.lines.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-foreground">{formatCurrency(snapshot.services.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">IVA{snapshot.services.taxPct > 0 ? ` ${snapshot.services.taxPct} %` : ""}</dt>
              <dd className="text-foreground">{formatCurrency(snapshot.services.taxAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Total</dt>
              <dd className="font-medium text-foreground">{formatCurrency(snapshot.services.total)}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Precio final</dt>
              <dd className="font-medium text-foreground">{formatCurrency(breakdown.effectivePrice)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Enganche</dt>
              <dd className="text-foreground">{formatCurrency(breakdown.downPaymentAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Mensualidad ({snapshot.installmentsCount} pagos)</dt>
              <dd className="text-foreground">{formatCurrency(breakdown.monthlyPaymentAmount)}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <DownloadPdfButton snapshot={snapshot} />
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")}
        >
          <MessageCircle />
          Enviar por WhatsApp
        </a>
        <Button variant="ghost" size="lg" onClick={onReset} className="w-full sm:w-auto">
          <RotateCcw />
          Hacer otra
        </Button>
      </div>

      <p className="border-t border-border-subtle pt-3 text-sm text-muted">
        ¿Te gustó?{" "}
        <Link href={registroUrl} className="font-medium text-accent hover:underline">
          Crea tu cuenta gratis
        </Link>{" "}
        y envía cotizaciones reales con tu propio catálogo.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { PropertySelector } from "@/components/cotizador/property-selector";
import { FinancialCalculator, type FinancialInputs } from "@/components/cotizador/financial-calculator";
import { ClientCombobox } from "@/components/cotizador/client-combobox";
import { DemoQuoteResult } from "@/components/cotizador/demo-quote-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { calculatePricing } from "@/lib/pricing";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";
import type { Property, Client } from "@/lib/types";

const DEFAULT_INPUTS: FinancialInputs = {
  discountPct: 0,
  downPaymentPct: 20,
  installmentsCount: 12,
  finalPaymentPct: 0,
};

type DemoResult = { snapshot: QuoteSnapshot; whatsappUrl: string };

export function CotizadorClient({
  tenantSlug,
  properties,
  isDemo = false,
  registroUrl = "/registro",
}: {
  tenantSlug: string;
  properties: Property[];
  /** Tenant de demo: pide solo un nombre y no guarda nada (lib/demo-quote.ts). */
  isDemo?: boolean;
  registroUrl?: string;
}) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inputs, setInputs] = useState<FinancialInputs>(DEFAULT_INPUTS);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [demoClientName, setDemoClientName] = useState("");
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const demoResultRef = useRef<HTMLDivElement>(null);
  const [advisorName, setAdvisorName] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const breakdown = useMemo(
    () =>
      calculatePricing({
        listPrice: selectedProperty?.list_price ?? 0,
        discountPct: inputs.discountPct,
        downPaymentPct: inputs.downPaymentPct,
        installmentsCount: inputs.installmentsCount,
        finalPaymentPct: inputs.finalPaymentPct,
      }),
    [selectedProperty, inputs],
  );

  // El resultado de la demo queda debajo del formulario: se trae a la vista para que no pase
  // desapercibido tras pulsar el botón (sobre todo en celular).
  useEffect(() => {
    if (demoResult) demoResultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [demoResult]);

  const hasClient = isDemo ? demoClientName.trim().length >= 2 : Boolean(selectedClient);
  const canSubmit = Boolean(selectedProperty) && hasClient && !isSubmitting;

  function resetForm() {
    setSelectedProperty(null);
    setSelectedClient(null);
    setDemoClientName("");
    setDemoResult(null);
    setInputs(DEFAULT_INPUTS);
    setNotes("");
  }

  /** Demo: el servidor recalcula y devuelve el snapshot; nada se guarda y no hay pestaña de WhatsApp que abrir. */
  async function handleGenerateDemo() {
    if (!selectedProperty || !hasClient || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          clientName: demoClientName.trim(),
          advisorName: advisorName.trim() || undefined,
          discountPct: inputs.discountPct,
          downPaymentPct: inputs.downPaymentPct,
          installmentsCount: inputs.installmentsCount,
          finalPaymentPct: inputs.finalPaymentPct,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "No se pudo generar la cotización de prueba.");
        return;
      }
      setDemoResult({ snapshot: data.snapshot, whatsappUrl: data.whatsappUrl });
    } catch {
      setErrorMessage("Error de red al generar la cotización de prueba.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerateAndSend() {
    if (isDemo) return handleGenerateDemo();
    if (!selectedProperty || !selectedClient || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    // Safari/iOS solo deja abrir una pestaña si window.open ocurre sincrónicamente dentro del clic;
    // tras un await ya perdió la activación del usuario y la bloquea en silencio. Se abre en blanco
    // aquí mismo y se navega después con la URL real (sin "noopener": con ese flag el propio open()
    // devuelve null y no queda referencia para navegarla luego; el destino siempre es wa.me, así que
    // el riesgo de reverse-tabnabbing no aplica).
    const whatsappTab = window.open("", "_blank");

    try {
      const res = await fetch(`/api/${tenantSlug}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          clientId: selectedClient.id,
          advisorName: advisorName.trim() || undefined,
          discountPct: inputs.discountPct,
          downPaymentPct: inputs.downPaymentPct,
          installmentsCount: inputs.installmentsCount,
          finalPaymentPct: inputs.finalPaymentPct,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        whatsappTab?.close();
        setErrorMessage(data.error ?? "No se pudo generar la cotización.");
        return;
      }

      if (whatsappTab) {
        whatsappTab.location.href = data.whatsappUrl;
      } else {
        // El navegador ya bloqueó el open en blanco (poco común): último intento directo.
        window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setSelectedProperty(null);
      setSelectedClient(null);
      setInputs(DEFAULT_INPUTS);
      setNotes("");
    } catch {
      whatsappTab?.close();
      setErrorMessage("Error de red al generar la cotización.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <PropertySelector
        properties={properties}
        selectedId={selectedProperty?.id ?? null}
        onSelect={setSelectedProperty}
      />

      {selectedProperty && (
        <>
          <FinancialCalculator
            listPrice={selectedProperty.list_price}
            inputs={inputs}
            onChange={setInputs}
            breakdown={breakdown}
          />

          <div className="rounded-lg border border-border-subtle bg-surface p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              {isDemo ? "Cliente de prueba" : "Cliente"}
            </h2>
            {isDemo ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="demo-client-name" className="text-xs font-medium text-muted">
                  Nombre
                </label>
                <Input
                  id="demo-client-name"
                  value={demoClientName}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(e) => setDemoClientName(e.target.value)}
                  placeholder="Ej. Laura Hernández"
                />
                <p className="text-xs text-muted">
                  Con solo el nombre basta. En la demo no se guarda ningún dato.
                </p>
              </div>
            ) : (
              <ClientCombobox
                tenantSlug={tenantSlug}
                selected={selectedClient}
                onSelect={setSelectedClient}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">
                Asesor (opcional)
              </label>
              <Input
                value={advisorName}
                onChange={(e) => setAdvisorName(e.target.value)}
                placeholder="Nombre del asesor"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">
                Notas para el PDF (opcional)
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condiciones especiales, vigencia, etc."
              />
            </div>
          </div>
        </>
      )}

      {demoResult ? (
        <div ref={demoResultRef}>
          <DemoQuoteResult
            snapshot={demoResult.snapshot}
            whatsappUrl={demoResult.whatsappUrl}
            registroUrl={registroUrl}
            onReset={resetForm}
          />
        </div>
      ) : null}

      {errorMessage && <p className="text-sm text-danger">{errorMessage}</p>}

      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-border-subtle bg-background/95 py-4 backdrop-blur">
        <div>
          <p className="text-xs text-muted">Total de la operación</p>
          <p className="text-2xl font-semibold text-foreground">
            {selectedProperty ? formatCurrency(breakdown.effectivePrice) : "—"}
          </p>
        </div>
        <Button size="lg" disabled={!canSubmit} onClick={handleGenerateAndSend}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isDemo ? "Generar cotización de prueba" : "Generar PDF y enviar por WhatsApp"}
        </Button>
      </div>
    </div>
  );
}

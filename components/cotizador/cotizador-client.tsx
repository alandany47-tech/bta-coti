"use client";

import { useMemo, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { PropertySelector } from "@/components/cotizador/property-selector";
import { FinancialCalculator, type FinancialInputs } from "@/components/cotizador/financial-calculator";
import { ClientCombobox } from "@/components/cotizador/client-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { calculatePricing } from "@/lib/pricing";
import type { Property, Client } from "@/lib/types";

const DEFAULT_INPUTS: FinancialInputs = {
  discountPct: 0,
  downPaymentPct: 20,
  installmentsCount: 12,
  finalPaymentPct: 0,
};

export function CotizadorClient({
  tenantSlug,
  properties,
}: {
  tenantSlug: string;
  properties: Property[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inputs, setInputs] = useState<FinancialInputs>(DEFAULT_INPUTS);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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

  const canSubmit = Boolean(selectedProperty) && Boolean(selectedClient) && !isSubmitting;

  async function handleGenerateAndSend() {
    if (!selectedProperty || !selectedClient || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

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
        setErrorMessage(data.error ?? "No se pudo generar la cotización.");
        return;
      }

      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      setSelectedProperty(null);
      setSelectedClient(null);
      setInputs(DEFAULT_INPUTS);
      setNotes("");
    } catch {
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
              Cliente
            </h2>
            <ClientCombobox
              tenantSlug={tenantSlug}
              selected={selectedClient}
              onSelect={setSelectedClient}
            />
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
          Generar PDF y enviar por WhatsApp
        </Button>
      </div>
    </div>
  );
}

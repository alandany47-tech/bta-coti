"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildQuotePdf, downloadBlob } from "@/lib/pdf-client";
import type { QuoteSnapshot } from "@/lib/quote-snapshot";

export function DownloadPdfButton({ snapshot }: { snapshot: QuoteSnapshot }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const blob = await buildQuotePdf(snapshot);
      const folio = snapshot.number ? String(snapshot.number).padStart(4, "0") : snapshot.quoteId.slice(0, 8);
      downloadBlob(blob, `Cotizacion-${folio}.pdf`);
    } catch {
      setError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleClick} disabled={busy} size="lg" className="w-full sm:w-auto">
        {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
        {busy ? "Preparando PDF…" : "Descargar PDF"}
      </Button>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

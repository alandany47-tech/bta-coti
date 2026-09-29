"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PortalButton({ tenantSlug }: { tenantSlug: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/${tenantSlug}/billing/portal`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo abrir el portal.");
      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "Abriendo..." : "Ir al portal de facturación"}
      </Button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

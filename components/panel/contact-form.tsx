"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShareButton } from "@/components/storefront/share-button";
import { formatWhatsappDisplay } from "@/lib/catalog";

/** Mi negocio: el WhatsApp que recibe las consultas y cotizaciones de la vitrina, y el enlace para compartirla. */
export function ContactForm({
  tenantSlug,
  tenantName,
  initialWhatsapp,
  catalogUrl,
}: {
  tenantSlug: string;
  tenantName: string;
  initialWhatsapp: string | null;
  catalogUrl: string;
}) {
  const [value, setValue] = useState(initialWhatsapp ? formatWhatsappDisplay(initialWhatsapp) : "");
  const [saved, setSaved] = useState<string | null>(initialWhatsapp);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch(`/api/${tenantSlug}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el número.");
        return;
      }
      setSaved(data.whatsapp);
      setValue(data.whatsapp ? formatWhatsappDisplay(data.whatsapp) : "");
      setJustSaved(true);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = (saved ? formatWhatsappDisplay(saved) : "") !== value.trim();

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="whatsapp" className="text-sm font-medium text-ink">
          WhatsApp del negocio
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setJustSaved(false);
            }}
            placeholder="55 1234 5678"
            className="sm:max-w-xs"
          />
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
        </div>
        <p className="text-[13px] text-ink-3">
          Escribe 10 dígitos con lada (se toma como México, +52) o el número completo con código de país. Tus clientes
          te escriben a este número desde «Consultar por WhatsApp» y «Enviar mi cotización». Déjalo vacío para que
          ellos elijan a quién mandarlo.
        </p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {justSaved ? <p role="status" className="text-sm text-ok">{saved ? "Número guardado." : "Número quitado."}</p> : null}
      </form>

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 className="text-lg">Tu catálogo público</h2>
        <p className="break-all text-sm text-ink-2">{catalogUrl}</p>
        <div className="flex flex-wrap gap-3">
          <ShareButton url={catalogUrl} title={tenantName} label="Compartir enlace" />
          <a
            href={catalogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-sunken"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Abrir mi catálogo
          </a>
        </div>
      </div>
    </div>
  );
}

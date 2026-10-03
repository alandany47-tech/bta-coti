"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuoteView } from "@/components/quote/quote-view";
import { buildSampleSnapshot } from "@/lib/quote-sample";
import { QUOTE_TEMPLATES, templateIncludedInPlan, type QuoteTemplateCode } from "@/lib/quote-templates";
import type { Property } from "@/lib/types";

/** Panel → Plantillas: elegir con vista previa en vivo (la misma `QuoteView` que ve el cliente). */
export function TemplatePicker({
  tenantSlug,
  tenantName,
  logoUrl,
  brandColor,
  initialCode,
  planLimit,
  property,
  createdAt,
  isDemo,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
  initialCode: QuoteTemplateCode;
  planLimit: number | null;
  property: Property | null;
  createdAt: string;
  isDemo: boolean;
}) {
  const [saved, setSaved] = useState(initialCode);
  const [preview, setPreview] = useState(initialCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildSampleSnapshot({ tenantName, logoUrl, brandColor, templateCode: preview, property, createdAt }),
    [tenantName, logoUrl, brandColor, preview, property, createdAt],
  );
  const included = templateIncludedInPlan(preview, planLimit);

  async function use() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: preview }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "No se pudo guardar.");
      setSaved(preview);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="radiogroup" aria-label="Plantilla de cotización" className="grid gap-3 sm:grid-cols-3">
        {QUOTE_TEMPLATES.map((t) => {
          const locked = !templateIncludedInPlan(t.code, planLimit);
          const selected = preview === t.code;
          return (
            <button
              key={t.code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setPreview(t.code);
                setError(null);
              }}
              className={`flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors ${selected ? "border-ink bg-paper" : "border-line bg-surface hover:border-line-strong"}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                  {t.name}
                </span>
                {saved === t.code ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                    <Check className="h-3 w-3" strokeWidth={2} aria-hidden /> En uso
                  </span>
                ) : locked ? (
                  <Lock className="h-4 w-4 text-ink-3" strokeWidth={1.5} aria-label="No incluida en tu plan" />
                ) : null}
              </span>
              <span className="text-sm text-ink-2">{t.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={use} disabled={saving || saved === preview || !included}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {saved === preview ? "Esta es tu plantilla" : "Usar esta plantilla"}
        </Button>
        {!included ? <span className="text-sm text-ink-2">Tu plan no incluye esta plantilla.</span> : null}
        {isDemo ? <span className="text-sm text-ink-2">En la demo puedes probarlas, no guardar la elección.</span> : null}
        {error ? (
          <span role="alert" className="text-sm text-danger">
            {error}
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border border-line bg-sunken">
        <p className="px-4 pt-3 text-xs uppercase tracking-wider text-ink-3">Vista previa · así la ve tu cliente y así sale el PDF</p>
        <QuoteView snapshot={snapshot} validUntil={null} />
      </div>
    </div>
  );
}

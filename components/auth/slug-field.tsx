"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";
import { normalizeSlugInput, slugError } from "@/lib/auth/register-schema";

type Status = "idle" | "checking" | "free" | "taken" | "invalid" | "limited";

const HINTS: Record<Status, string> = {
  idle: "",
  checking: "Revisando...",
  free: "Disponible.",
  taken: "Ese subdominio no está disponible. Prueba con otro.",
  invalid: "",
  limited: "Demasiadas consultas. Espera un momento.",
};

export function SlugField({
  defaultValue = "",
  error,
  onSuggest,
}: {
  defaultValue?: string;
  error?: string;
  onSuggest?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>("idle");
  const slug = normalizeSlugInput(value);
  const format = slug ? slugError(slug) : null;

  useEffect(() => {
    if (!slug || slugError(slug)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("checking");
      try {
        const res = await fetch(`/api/slug-available?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
        });
        if (res.status === 429) return setStatus("limited");
        const body = (await res.json()) as { available: boolean };
        setStatus(body.available ? "free" : "taken");
      } catch {
        if (!controller.signal.aborted) setStatus("idle");
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  const visible = format ? "invalid" : slug ? status : "idle";
  const message = error ?? (visible === "invalid" ? format : HINTS[visible]);
  const tone =
    error || visible === "taken" || visible === "invalid"
      ? "text-danger"
      : visible === "free"
        ? "text-ok"
        : "text-muted";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="slug" className="text-xs font-medium text-foreground-muted">
        Tu dirección
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="slug"
          name="slug"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus("idle");
          }}
          placeholder={onSuggest ?? "tu-negocio"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <span className="shrink-0 text-sm text-muted">.{BRAND.domain}</span>
      </div>
      <p className={`min-h-4 text-xs ${tone}`} aria-live="polite">
        {message}
      </p>
    </div>
  );
}

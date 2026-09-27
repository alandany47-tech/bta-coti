"use client";

import { useRef, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TEMPLATES,
  EXAMPLE_VARS,
  MAX_TEMPLATE_LENGTH,
  MODULE_LABEL,
  MODULE_VARIABLES,
  renderMessage,
  type MessageModule,
} from "@/lib/message-templates";

export function MessageTemplateEditor({
  tenantSlug,
  module,
  initialBody,
}: {
  tenantSlug: string;
  module: MessageModule;
  initialBody: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = body !== savedBody;
  const overLimit = body.length > MAX_TEMPLATE_LENGTH;
  const preview = renderMessage(body, EXAMPLE_VARS[module]);

  function insertVariable(key: string) {
    const el = textareaRef.current;
    const token = `{${key}}`;
    if (!el) {
      setBody((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/${tenantSlug}/message-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "No se pudo guardar el mensaje.");
        return;
      }
      setSavedBody(body);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Error de red al guardar el mensaje.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{MODULE_LABEL[module]}</h2>
        <button
          type="button"
          onClick={() => setBody(DEFAULT_TEMPLATES[module])}
          className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar mensaje original
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MODULE_VARIABLES[module].map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => insertVariable(variable.key)}
            className="rounded-full border border-line-strong bg-sunken px-2.5 py-1 text-xs text-ink-2 hover:border-accent hover:text-accent"
          >
            {variable.label}
          </button>
        ))}
      </div>

      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={MAX_TEMPLATE_LENGTH + 200}
        className="w-full resize-y rounded-md border border-line bg-paper p-3 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <div className={`text-right text-xs ${overLimit ? "text-danger" : "text-ink-3"}`}>
        {body.length} / {MAX_TEMPLATE_LENGTH}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-ink-3">Vista previa</p>
        <div className="whitespace-pre-wrap rounded-md bg-sunken p-3 text-sm text-ink-2">{preview}</div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving || overLimit || !dirty} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
        {saved ? <span className="text-xs text-ok">Guardado.</span> : null}
        {error ? (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

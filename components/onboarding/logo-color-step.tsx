"use client";

import { useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { uploadMedia } from "@/lib/media-client";
import { Input } from "@/components/ui/input";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function LogoColorStep({
  tenantSlug,
  tenantName,
  logoUrl,
  brandColor,
  isDemo,
  onLogoChange,
  onColorChange,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  brandColor: string;
  isDemo: boolean;
  onLogoChange: (url: string) => void;
  onColorChange: (color: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [colorDraft, setColorDraft] = useState(brandColor);
  const [savingColor, setSavingColor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    const result = await uploadMedia({ tenant: tenantSlug, itemId: null, kind: "logo", file });
    setUploading(false);
    if (!result.ok) return setError(result.error);
    onLogoChange(result.media.url);
  }

  async function saveColor(color: string) {
    if (!HEX_RE.test(color)) return;
    setSavingColor(true);
    setError(null);
    const response = await fetch(`/api/${tenantSlug}/branding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor: color }),
    });
    setSavingColor(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return setError(body.error ?? "No se pudo guardar el color.");
    }
    onColorChange(color);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-medium text-foreground-muted">Logo</p>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="h-14 w-14 rounded object-contain" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded text-lg font-semibold text-background"
              style={{ backgroundColor: colorDraft }}
            >
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <button
              type="button"
              disabled={uploading || isDemo}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {logoUrl ? "Cambiar logo" : "Subir logo"}
            </button>
            {isDemo ? <p className="mt-1 text-xs text-muted">La demo no permite subir archivos.</p> : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-foreground-muted">Color de marca</p>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorDraft}
            disabled={isDemo}
            onChange={(e) => {
              setColorDraft(e.target.value);
              void saveColor(e.target.value);
            }}
            className="h-9 w-9 cursor-pointer rounded border border-border-subtle bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Input
            value={colorDraft}
            disabled={isDemo}
            onChange={(e) => setColorDraft(e.target.value)}
            onBlur={(e) => void saveColor(e.target.value)}
            maxLength={7}
            className="w-28 font-mono text-sm"
          />
          {savingColor ? <span className="text-xs text-muted">Guardando...</span> : null}
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { deleteMediaById, uploadMedia, type UploadStage } from "@/lib/media-client";
import { thumbUrl } from "@/lib/media";
import type { Property } from "@/lib/types";

type QueueItem = { id: string; name: string; stage: UploadStage; progress: number; error?: string };

const STAGE_LABEL: Record<UploadStage, string> = {
  compressing: "Optimizando",
  uploading: "Subiendo",
  confirming: "Confirmando",
};

const tileControl =
  "flex h-7 w-7 items-center justify-center rounded-md bg-paper/90 text-ink-2 transition-colors hover:text-ink disabled:opacity-40 disabled:hover:text-ink-2";

export function PropertyMediaUploader({
  tenantSlug,
  property,
  mediaIds,
  onUpdate,
}: {
  tenantSlug: string;
  property: Property;
  mediaIds: Record<string, string>;
  onUpdate: (property: Property, mediaIds?: Record<string, string>) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const planInputRef = useRef<HTMLInputElement>(null);

  function patchQueue(id: string, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function uploadFiles(files: File[], kind: "image" | "plan") {
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    let current = property;
    let ids = mediaIds;
    // Secuencial: la cuota se valida por archivo y cada confirmación actualiza la propiedad.
    for (const file of files) {
      const id = crypto.randomUUID();
      setQueue((prev) => [...prev, { id, name: file.name, stage: "compressing", progress: 0 }]);
      const result = await uploadMedia({
        tenant: tenantSlug,
        itemId: property.id,
        kind,
        file,
        onStage: (stage) => patchQueue(id, { stage }),
        onProgress: (progress) => patchQueue(id, { progress }),
      });
      if (!result.ok) {
        patchQueue(id, { error: result.error });
        setError(result.error);
        continue;
      }
      setQueue((prev) => prev.filter((item) => item.id !== id));
      if (result.property) {
        current = { ...current, ...result.property };
        ids = { ...ids, [result.media.url]: result.media.id };
        onUpdate(current, ids);
      }
    }
    setBusy(false);
  }

  async function removeImage(url: string) {
    setError(null);
    setPendingRemoval(url);
    try {
      const mediaId = mediaIds[url];
      if (mediaId) {
        const failure = await deleteMediaById(tenantSlug, mediaId);
        if (failure) return setError(failure);
        onUpdate({ ...property, images: property.images.filter((u) => u !== url) });
      } else {
        await saveOrder(property.images.filter((u) => u !== url));
      }
    } finally {
      setPendingRemoval(null);
    }
  }

  async function removePlan() {
    if (!property.floor_plan_url) return;
    setError(null);
    setPendingRemoval(property.floor_plan_url);
    try {
      const mediaId = mediaIds[property.floor_plan_url];
      if (mediaId) {
        const failure = await deleteMediaById(tenantSlug, mediaId);
        if (failure) return setError(failure);
      } else {
        const response = await fetch(`/api/${tenantSlug}/properties/${property.id}/images`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ floor_plan_url: null }),
        });
        if (!response.ok) return setError((await response.json().catch(() => ({}))).error ?? "No se pudo quitar el plano.");
      }
      onUpdate({ ...property, floor_plan_url: null });
    } finally {
      setPendingRemoval(null);
    }
  }

  async function saveOrder(images: string[]) {
    const previous = property;
    onUpdate({ ...property, images });
    const response = await fetch(`/api/${tenantSlug}/properties/${property.id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!response.ok) {
      onUpdate(previous);
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el cambio.");
    }
  }

  function move(index: number, delta: -1 | 1) {
    const images = [...property.images];
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    [images[index], images[target]] = [images[target], images[index]];
    void saveOrder(images);
  }

  const plan = property.floor_plan_url;
  const planIsPdf = plan?.toLowerCase().endsWith(".pdf");
  const uploading = queue.some((item) => !item.error);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-muted">
            Imágenes ({property.images.length})
            {property.images.length > 1 ? " · la primera es la portada" : ""}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Subir imágenes
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadFiles(Array.from(e.target.files ?? []), "image");
              e.target.value = "";
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-5">
          {property.images.map((url, index) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-md border border-line bg-sunken"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(url)} alt="" className="h-full w-full object-cover" loading="lazy" />
              {index === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-paper/90 px-1.5 py-0.5 text-[11px] font-medium text-ink">
                  Portada
                </span>
              ) : null}
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-100 transition-opacity duration-[120ms] sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={tileControl}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Mover a la izquierda"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    className={tileControl}
                    onClick={() => move(index, 1)}
                    disabled={index === property.images.length - 1}
                    aria-label="Mover a la derecha"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <button
                  type="button"
                  className={`${tileControl} hover:!text-danger`}
                  onClick={() => void removeImage(url)}
                  disabled={pendingRemoval === url}
                  aria-label="Eliminar imagen"
                >
                  {pendingRemoval === url ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          ))}

          {queue.map((item) => (
            <div
              key={item.id}
              className="relative flex aspect-square flex-col justify-end gap-1 overflow-hidden rounded-md border border-dashed border-line-strong p-2"
            >
              <p className="truncate text-[11px] text-ink-2" title={item.name}>
                {item.name}
              </p>
              {item.error ? (
                <>
                  <p className="text-[11px] leading-tight text-danger">{item.error}</p>
                  <button
                    type="button"
                    onClick={() => setQueue((prev) => prev.filter((q) => q.id !== item.id))}
                    className="self-start text-[11px] text-ink-2 underline"
                  >
                    Descartar
                  </button>
                </>
              ) : (
                <>
                  <p className="tabular text-[11px] text-ink-3">
                    {STAGE_LABEL[item.stage]}
                    {item.stage === "uploading" ? ` ${Math.round(item.progress * 100)}%` : ""}
                  </p>
                  <div className="h-0.5 w-full overflow-hidden rounded bg-line">
                    <div
                      className="h-full bg-accent transition-[width] duration-[120ms]"
                      style={{ width: `${item.stage === "uploading" ? item.progress * 100 : item.stage === "confirming" ? 100 : 8}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          ))}

          {property.images.length === 0 && queue.length === 0 && (
            <div className="col-span-full flex aspect-[3/1] items-center justify-center rounded-md border border-dashed border-line-strong text-xs text-muted">
              Sin imágenes. Se optimizan solas: una foto de 8 MB queda en menos de 400 KB.
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-xs font-medium text-muted">Plano (imagen o PDF)</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => planInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />
            {plan ? "Reemplazar plano" : "Subir plano"}
          </button>
          <input
            ref={planInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFiles([file], "plan");
              e.target.value = "";
            }}
          />
        </div>

        {plan ? (
          <div className="group relative flex h-28 w-full max-w-xs items-center justify-center overflow-hidden rounded-md border border-line bg-sunken">
            {planIsPdf ? (
              <a
                href={plan}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs text-ink-2 underline"
              >
                <FileText className="h-4 w-4" strokeWidth={1.5} />
                Plano en PDF
              </a>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan} alt="" className="h-full w-full object-contain" />
            )}
            <button
              type="button"
              onClick={() => void removePlan()}
              disabled={pendingRemoval === plan}
              className={`${tileControl} absolute right-1 top-1 hover:!text-danger`}
              aria-label="Eliminar plano"
            >
              {pendingRemoval === plan ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          </div>
        ) : (
          <div className="flex h-28 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-line-strong text-xs text-muted">
            Sin plano
          </div>
        )}
        {planIsPdf ? (
          <p className="mt-1 text-xs text-muted">Los planos en PDF aún no se incluyen en el dossier; sube una imagen para verlo ahí.</p>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {uploading ? "Subiendo archivos" : ""}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

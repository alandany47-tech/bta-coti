"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, Loader2, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateMediaFile, MAX_PROPERTY_IMAGES } from "@/lib/uploads";
import type { Property } from "@/lib/types";

export function PropertyMediaUploader({
  tenantSlug,
  property,
  onUpdate,
}: {
  tenantSlug: string;
  property: Property;
  onUpdate: (property: Property) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingPlan, setIsUploadingPlan] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const planInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, kind: "image" | "floor_plan") {
    const validationError = validateMediaFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    const res = await fetch(
      `/api/${tenantSlug}/properties/${property.id}/media`,
      { method: "POST", body: formData },
    );
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo subir el archivo.");
      return;
    }

    onUpdate(data.property as Property);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remainingSlots = MAX_PROPERTY_IMAGES - property.images.length;
    if (remainingSlots <= 0) {
      setError(`Ya alcanzaste el máximo de ${MAX_PROPERTY_IMAGES} imágenes.`);
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    setIsUploadingImages(true);
    try {
      for (const file of selected) {
        // Secuencial: cada subida actualiza el array `images` de la propiedad,
        // así que se evita una condición de carrera si van en paralelo.
        await uploadFile(file, "image");
      }
    } finally {
      setIsUploadingImages(false);
    }
  }

  async function handlePlanFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingPlan(true);
    try {
      await uploadFile(file, "floor_plan");
    } finally {
      setIsUploadingPlan(false);
    }
  }

  async function handleRemoveImage(url: string) {
    setError(null);
    setPendingRemoval(url);
    try {
      const res = await fetch(
        `/api/${tenantSlug}/properties/${property.id}/media?kind=image&url=${encodeURIComponent(url)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo eliminar la imagen.");
        return;
      }
      onUpdate(data.property as Property);
    } finally {
      setPendingRemoval(null);
    }
  }

  async function handleRemovePlan() {
    if (!property.floor_plan_url) return;
    setError(null);
    setPendingRemoval(property.floor_plan_url);
    try {
      const res = await fetch(
        `/api/${tenantSlug}/properties/${property.id}/media?kind=floor_plan&url=${encodeURIComponent(property.floor_plan_url)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo eliminar el plano.");
        return;
      }
      onUpdate(data.property as Property);
    } finally {
      setPendingRemoval(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">
            Imágenes ({property.images.length}/{MAX_PROPERTY_IMAGES})
          </span>
          <button
            type="button"
            disabled={isUploadingImages || property.images.length >= MAX_PROPERTY_IMAGES}
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadingImages ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            Subir imágenes
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {property.images.map((url) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-md border border-border-subtle bg-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemoveImage(url)}
                disabled={pendingRemoval === url}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 disabled:opacity-50"
                aria-label="Eliminar imagen"
              >
                {pendingRemoval === url ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </div>
          ))}
          {property.images.length === 0 && (
            <div className="col-span-full flex aspect-[3/1] items-center justify-center rounded-md border border-dashed border-border-subtle text-xs text-muted">
              Sin imágenes
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Plano</span>
          <button
            type="button"
            disabled={isUploadingPlan}
            onClick={() => planInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploadingPlan ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            {property.floor_plan_url ? "Reemplazar plano" : "Subir plano"}
          </button>
          <input
            ref={planInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handlePlanFile(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {property.floor_plan_url ? (
          <div className="group relative flex h-28 w-full max-w-xs items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={property.floor_plan_url}
              alt=""
              className="h-full w-full object-contain"
            />
            <button
              type="button"
              onClick={handleRemovePlan}
              disabled={pendingRemoval === property.floor_plan_url}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 disabled:opacity-50"
              aria-label="Eliminar plano"
            >
              {pendingRemoval === property.floor_plan_url ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "flex h-28 w-full max-w-xs items-center justify-center gap-2 rounded-md border border-dashed border-border-subtle text-xs text-muted",
            )}
          >
            <FileImage className="h-4 w-4" />
            Sin plano
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

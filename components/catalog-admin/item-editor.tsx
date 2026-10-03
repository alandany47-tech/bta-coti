"use client";

import { useId, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyMediaUploader } from "@/components/properties/property-media-uploader";
import { attrsToDetails, ITEM_LIMITS, type CatalogKind, type CatalogRow } from "@/lib/item-input";

const fieldClass =
  "w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted";

export const KIND_LABEL: Record<CatalogKind, string> = { product: "Producto", service: "Servicio" };

type Detail = { label: string; value: string };

/** Alta y edición de un producto o servicio: datos, ficha, fotos y borrado. */
export function ItemEditor({
  tenantSlug,
  item,
  kinds,
  categories,
  mediaIds,
  onSaved,
  onMediaChange,
  onDeleted,
  onClose,
}: {
  tenantSlug: string;
  /** Sin `item` = alta nueva (las fotos se suben después de guardar, cuando ya hay id). */
  item: CatalogRow | null;
  kinds: CatalogKind[];
  categories: string[];
  mediaIds: Record<string, string>;
  onSaved: (item: CatalogRow) => void;
  onMediaChange: (item: CatalogRow, ids?: Record<string, string>) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const [kind, setKind] = useState<CatalogKind>(item?.kind ?? kinds[0]);
  const [title, setTitle] = useState(item?.title ?? "");
  const [price, setPrice] = useState(item ? String(Number(item.price)) : "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [visible, setVisible] = useState(item ? item.status !== "hidden" : true);
  const [details, setDetails] = useState<Detail[]>(item ? attrsToDetails(item.attrs) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const id = (name: string) => `${uid}-${name}`;
  const patchDetail = (index: number, patch: Partial<Detail>) =>
    setDetails((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/${tenantSlug}/items${item ? `/${item.id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          price,
          unit,
          category,
          description,
          sku,
          status: visible ? "available" : "hidden",
          details,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "No se pudo guardar.");
      setSaved(true);
      onSaved(data.item as CatalogRow);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? "No se pudo borrar.");
      }
      onDeleted(item.id);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 border-t border-line p-4 sm:p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-label={item ? "Editar ítem" : "Nuevo ítem"}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("title")} className="text-sm font-medium text-ink">
              Nombre
            </label>
            <Input
              id={id("title")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={ITEM_LIMITS.title}
              required
              placeholder={kind === "service" ? "Instalación de calentador" : "Mesa de comedor nogal"}
            />
          </div>
          {kinds.length > 1 && !item ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={id("kind")} className="text-sm font-medium text-ink">
                Tipo
              </label>
              <select id={id("kind")} value={kind} onChange={(e) => setKind(e.target.value as CatalogKind)} className={`${fieldClass} h-10 sm:w-40`}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("price")} className="text-sm font-medium text-ink">
              Precio (MXN)
            </label>
            <Input id={id("price")} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            <p className="text-xs text-ink-3">En 0 se muestra “A cotizar”.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("unit")} className="text-sm font-medium text-ink">
              Unidad <span className="font-normal text-ink-3">(opcional)</span>
            </label>
            <Input id={id("unit")} value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={ITEM_LIMITS.unit} placeholder={kind === "service" ? "hora, visita…" : "pieza, m²…"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id("category")} className="text-sm font-medium text-ink">
              Categoría <span className="font-normal text-ink-3">(opcional)</span>
            </label>
            <Input id={id("category")} list={id("categories")} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={ITEM_LIMITS.category} placeholder="Comedores" />
            <datalist id={id("categories")}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("description")} className="text-sm font-medium text-ink">
            Descripción <span className="font-normal text-ink-3">(opcional)</span>
          </label>
          <textarea
            id={id("description")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={ITEM_LIMITS.description}
            rows={3}
            className={fieldClass}
            placeholder="Lo que tu cliente necesita saber antes de escribirte."
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">
            Datos de la ficha <span className="font-normal text-ink-3">(medidas, material, garantía…)</span>
          </legend>
          {details.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
              <Input aria-label="Nombre del dato" value={row.label} onChange={(e) => patchDetail(index, { label: e.target.value })} maxLength={ITEM_LIMITS.detailLabel} placeholder="Material" />
              <Input aria-label="Valor del dato" value={row.value} onChange={(e) => patchDetail(index, { value: e.target.value })} maxLength={ITEM_LIMITS.detailValue} placeholder="Nogal macizo" />
              <button
                type="button"
                onClick={() => setDetails((rows) => rows.filter((_, i) => i !== index))}
                aria-label="Quitar dato"
                className="flex h-10 w-10 items-center justify-center rounded-md text-ink-3 transition-colors hover:text-danger"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {details.length < ITEM_LIMITS.details ? (
            <button
              type="button"
              onClick={() => setDetails((rows) => [...rows, { label: "", value: "" }])}
              className="flex h-9 w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Agregar dato
            </button>
          ) : null}
        </fieldset>

        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-1.5 sm:max-w-xs">
            <label htmlFor={id("sku")} className="text-sm font-medium text-ink">
              Código <span className="font-normal text-ink-3">(opcional, único)</span>
            </label>
            <Input id={id("sku")} value={sku} onChange={(e) => setSku(e.target.value)} maxLength={ITEM_LIMITS.sku} />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Visible en mi catálogo
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            {item ? "Guardar cambios" : "Crear ítem"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            {item ? "Cerrar" : "Cancelar"}
          </Button>
          {saved && item ? (
            <span role="status" className="text-sm text-ok">
              Guardado
            </span>
          ) : null}
          {error ? (
            <span role="alert" className="text-sm text-danger">
              {error}
            </span>
          ) : null}
        </div>
      </form>

      {item ? (
        <>
          <div>
            <h3 className="mb-3 text-sm font-medium text-ink">Fotos</h3>
            <PropertyMediaUploader tenantSlug={tenantSlug} property={item} mediaIds={mediaIds} onUpdate={onMediaChange} showPlan={false} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {confirmDelete ? (
              <>
                <span className="text-sm text-ink-2">¿Eliminar “{item.title}”? También se borran sus fotos.</span>
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin" /> : null}
                  Sí, eliminar
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-9 items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-danger">
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Eliminar ítem
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-ink-3">Crea el ítem para poder subir sus fotos.</p>
      )}
    </div>
  );
}

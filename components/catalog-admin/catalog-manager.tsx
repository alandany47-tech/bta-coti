"use client";

import { useMemo, useState } from "react";
import { ExternalLink, EyeOff, ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemEditor, KIND_LABEL } from "@/components/catalog-admin/item-editor";
import { thumbUrl } from "@/lib/media";
import { formatCurrency } from "@/lib/utils";
import type { CatalogKind, CatalogRow } from "@/lib/item-input";

type Editing = string | "new" | null;

/** Panel → Catálogo: lista de productos/servicios del negocio con alta, edición, fotos y ocultar. */
export function CatalogManager({
  tenantSlug,
  initialItems,
  initialMediaIds,
  kinds,
  catalogUrl,
  isDemo,
}: {
  tenantSlug: string;
  initialItems: CatalogRow[];
  initialMediaIds: Record<string, string>;
  kinds: CatalogKind[];
  catalogUrl: string;
  isDemo: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [mediaIds, setMediaIds] = useState(initialMediaIds);
  const [editing, setEditing] = useState<Editing>(initialItems.length === 0 && !isDemo ? "new" : null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );
  const hiddenCount = items.filter((i) => i.status === "hidden").length;

  function upsert(item: CatalogRow) {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev]));
  }

  async function toggleVisibility(item: CatalogRow) {
    setToggling(item.id);
    setToggleError(null);
    try {
      const res = await fetch(`/api/${tenantSlug}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status === "hidden" ? "available" : "hidden" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setToggleError(data.error ?? "No se pudo cambiar la visibilidad.");
      upsert(data.item as CatalogRow);
    } catch {
      setToggleError("Error de red. Intenta de nuevo.");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {isDemo ? (
        <p className="rounded-md border border-line bg-sunken px-4 py-3 text-sm text-ink-2">
          Esta es la demo: puedes explorar el editor, pero no se guardan cambios. En tu cuenta de prueba sí.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          {items.length} {items.length === 1 ? "ítem" : "ítems"}
          {hiddenCount > 0 ? ` · ${hiddenCount} oculto${hiddenCount === 1 ? "" : "s"}` : ""}
        </p>
        <div className="flex items-center gap-4">
          <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
            Ver mi catálogo
            <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </a>
          <Button onClick={() => setEditing("new")} disabled={editing === "new"}>
            <Plus />
            Nuevo ítem
          </Button>
        </div>
      </div>

      {editing === "new" ? (
        <section className="rounded-lg border border-line bg-paper">
          <h2 className="px-4 pt-4 text-lg sm:px-5">Nuevo ítem</h2>
          <ItemEditor
            tenantSlug={tenantSlug}
            item={null}
            kinds={kinds}
            categories={categories}
            mediaIds={mediaIds}
            onSaved={(saved) => {
              upsert(saved);
              setEditing(saved.id);
            }}
            onMediaChange={() => {}}
            onDeleted={() => {}}
            onClose={() => setEditing(null)}
          />
        </section>
      ) : null}

      {toggleError ? (
        <p role="alert" className="text-sm text-danger">
          {toggleError}
        </p>
      ) : null}

      {items.length === 0 && editing !== "new" ? (
        <div className="rounded-lg border border-dashed border-line-strong p-10 text-center text-sm text-ink-2">
          Todavía no hay nada en tu catálogo. Agrega tu primer producto o servicio.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const open = editing === item.id;
            const hidden = item.status === "hidden";
            const price = Number(item.price);
            return (
              <li key={item.id} className="rounded-lg border border-line bg-paper">
                <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-sunken">
                    {item.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl(item.images[0])} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-ink-3" strokeWidth={1.5} aria-label="Sin foto" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-medium ${hidden ? "text-ink-3" : "text-ink"}`}>{item.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
                      {[
                        <span key="kind">{KIND_LABEL[item.kind]}</span>,
                        item.category ? <span key="cat">{item.category}</span> : null,
                        <span key="price" className="tabular">
                          {price > 0 ? formatCurrency(price) : "A cotizar"}
                        </span>,
                        hidden ? (
                          <span key="hidden" className="inline-flex items-center gap-1 text-warn">
                            <EyeOff className="h-3 w-3" strokeWidth={1.5} aria-hidden /> Oculto
                          </span>
                        ) : null,
                      ]
                        .filter((node) => node !== null)
                        .map((node, index) => (
                          <span key={index} className="inline-flex items-center gap-1.5">
                            {index > 0 ? <span aria-hidden>·</span> : null}
                            {node}
                          </span>
                        ))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void toggleVisibility(item)} disabled={toggling === item.id} className="hidden sm:inline-flex">
                      {hidden ? "Mostrar" : "Ocultar"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(open ? null : item.id)} aria-expanded={open}>
                      {open ? "Cerrar" : "Editar"}
                    </Button>
                  </div>
                </div>
                {open ? (
                  <ItemEditor
                    key={item.id}
                    tenantSlug={tenantSlug}
                    item={item}
                    kinds={kinds}
                    categories={categories}
                    mediaIds={mediaIds}
                    onSaved={upsert}
                    onMediaChange={(updated, ids) => {
                      upsert({ ...item, ...updated });
                      if (ids) setMediaIds(ids);
                    }}
                    onDeleted={(id) => {
                      setItems((prev) => prev.filter((i) => i.id !== id));
                      setEditing(null);
                    }}
                    onClose={() => setEditing(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

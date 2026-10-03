"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AddButton } from "@/components/storefront/add-button";
import { categoryOf, filterItems, listCategories, type CatalogItem } from "@/lib/catalog";
import { cn, formatCurrency } from "@/lib/utils";

/** Cuadrícula del catálogo con búsqueda y categorías. Cada tarjeta lleva a su ficha (`/i/<id>`). */
export function CatalogBrowser({
  slug,
  items,
  accent,
}: {
  slug: string;
  items: CatalogItem[];
  accent: string;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const categories = useMemo(() => listCategories(items), [items]);
  const visible = useMemo(() => filterItems(items, { category, query }), [items, category, query]);
  const showFilters = items.length > 6 || categories.length > 1;

  return (
    <div>
      {showFilters ? (
        <div className="sticky top-0 z-20 -mx-6 border-b border-line bg-paper px-6 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o código"
              aria-label="Buscar en el catálogo"
              className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-[15px] text-ink placeholder:text-ink-3 focus-visible:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15 sm:max-w-sm"
            />
          </div>
          {categories.length > 1 ? (
            <div className="no-scrollbar -mb-px mt-1 flex gap-6 overflow-x-auto">
              {[{ name: null, label: "Todo", count: items.length }, ...categories.map((c) => ({ name: c.name, label: c.name, count: c.count }))].map(
                (tab) => {
                  const active = category === tab.name;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(tab.name)}
                      style={active ? { borderBottomColor: accent } : undefined}
                      className={cn(
                        "shrink-0 border-b-2 border-transparent py-3 text-[14px] transition-colors",
                        active ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
                      )}
                    >
                      {tab.label} <span className="tabular text-ink-3">{tab.count}</span>
                    </button>
                  );
                },
              )}
            </div>
          ) : (
            <div className="h-3" />
          )}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-ink">No hay resultados para «{query.trim()}».</p>
          <p className="mt-1 text-sm text-ink-2">Prueba con otra palabra o quita el filtro de categoría.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
            className="mt-4 text-sm font-medium text-ink underline underline-offset-4"
          >
            Ver todo el catálogo
          </button>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <li key={item.id} className="flex flex-col">
              <Link href={`/i/${item.id}`} className="group block flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sunken">
                  {item.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.images[0]}
                      alt=""
                      width={800}
                      height={600}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span aria-hidden className="flex h-full w-full items-center justify-center font-display text-4xl text-ink-3">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{item.title}</h3>
                </div>
                <p className="tabular mt-1 text-[15px] text-ink">
                  {formatCurrency(item.price)}
                  {item.unit ? <span className="ml-1 text-[13px] text-ink-3">por {item.unit}</span> : null}
                </p>
                {item.description ? (
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">{item.description}</p>
                ) : (
                  <p className="mt-1.5 text-[13px] text-ink-3">{categoryOf(item)}</p>
                )}
              </Link>
              <div className="mt-3">
                <AddButton slug={slug} item={{ id: item.id, title: item.title, price: item.price, unit: item.unit }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductCombobox({
  products,
  onSelect,
}: {
  products: Product[];
  onSelect: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, query]);

  function handleSelect(product: Product) {
    onSelect(product);
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Buscar producto por nombre o SKU…"
          className="pl-9"
        />
      </div>

      {isOpen && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border-subtle bg-surface shadow-lg">
          {matches.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(product)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-hover",
                )}
              >
                <span className="flex flex-col">
                  <span className="text-foreground">{product.name}</span>
                  <span className="text-xs text-muted">
                    {product.sku}
                    {product.category ? ` · ${product.category}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-foreground-muted">
                  {formatCurrency(product.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query && matches.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-muted">
          Sin resultados para &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

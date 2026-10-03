"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCart, setCartQty, useCart } from "@/lib/cart-store";
import { MAX_CART_LINES, MAX_LINE_QTY, type CartLine } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/** Agregar a "Mi cotización": un botón y, una vez agregado, un selector de cantidad. */
export function AddButton({
  slug,
  item,
  size = "sm",
  className,
}: {
  slug: string;
  item: Pick<CartLine, "id" | "title" | "price" | "unit">;
  size?: "sm" | "lg";
  className?: string;
}) {
  const lines = useCart(slug);
  const line = lines.find((l) => l.id === item.id);
  const full = !line && lines.length >= MAX_CART_LINES;

  if (!line) {
    return (
      <Button
        variant={size === "lg" ? "default" : "secondary"}
        size={size}
        disabled={full}
        onClick={() => addToCart(slug, item)}
        className={cn("w-full", className)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {full ? "Lista llena" : size === "lg" ? "Agregar a mi cotización" : "Agregar"}
      </Button>
    );
  }

  const stepper = size === "lg" ? "h-12" : "h-8";
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between rounded-md border border-line-strong bg-surface",
        stepper,
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Quitar una unidad de ${item.title}`}
        onClick={() => setCartQty(slug, item.id, line.qty - 1)}
        className="flex h-full w-11 items-center justify-center text-ink-2 transition-colors hover:text-ink active:scale-[0.97]"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="tabular text-sm font-medium text-ink" aria-live="polite">
        {line.qty}
        <span className={size === "lg" ? "" : "sr-only"}> en mi cotización</span>
      </span>
      <button
        type="button"
        aria-label={`Agregar una unidad de ${item.title}`}
        disabled={line.qty >= MAX_LINE_QTY}
        onClick={() => setCartQty(slug, item.id, line.qty + 1)}
        className="flex h-full w-11 items-center justify-center text-ink-2 transition-colors hover:text-ink active:scale-[0.97] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

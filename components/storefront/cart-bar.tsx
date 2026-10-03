"use client";

import { useRef } from "react";
import { MessageCircle, Minus, Plus, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { clearCart, setCartQty, useCart } from "@/lib/cart-store";
import { buildCartMessage, cartCount, cartTotal, MAX_LINE_QTY, whatsappHref } from "@/lib/catalog";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Barra fija "Mi cotización" y su hoja. Solo aparece cuando el visitante ya agregó algo. Enviar
 * abre WhatsApp con la lista como texto (al número del negocio, o a quien elija el visitante si el
 * negocio aún no configuró uno); no se guarda nada.
 */
export function CartBar({
  slug,
  businessName,
  whatsapp,
  catalogUrl,
}: {
  slug: string;
  businessName: string;
  whatsapp: string | null;
  catalogUrl: string;
}) {
  const lines = useCart(slug);
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (lines.length === 0) return null;

  const total = cartTotal(lines);
  const count = cartCount(lines);
  const href = whatsappHref(whatsapp, buildCartMessage({ businessName, lines, catalogUrl }));

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 p-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="animate-rise pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between gap-4 rounded-lg bg-ink px-4 py-3.5 text-left text-paper shadow-lg transition-transform active:scale-[0.99]"
        >
          <span className="text-sm">
            <span className="tabular font-medium">{count}</span> {count === 1 ? "ítem" : "ítems"} ·{" "}
            <span className="tabular font-medium">{formatCurrency(total)}</span>
          </span>
          <span className="text-sm font-medium">Ver mi cotización</span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="cart-title"
        className="sheet m-auto max-h-[85vh] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-title" className="text-[22px]">
            Mi cotización
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <ul className="divide-y divide-line px-5">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-snug text-ink">{line.title}</p>
                <p className="tabular mt-0.5 text-[13px] text-ink-3">
                  {formatCurrency(line.price)}
                  {line.unit ? ` por ${line.unit}` : ""}
                </p>
              </div>
              <div className="flex h-9 items-center rounded-md border border-line-strong">
                <button
                  type="button"
                  aria-label={`Quitar una unidad de ${line.title}`}
                  onClick={() => setCartQty(slug, line.id, line.qty - 1)}
                  className="flex h-full w-9 items-center justify-center text-ink-2 hover:text-ink active:scale-[0.97]"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="tabular w-6 text-center text-sm font-medium">{line.qty}</span>
                <button
                  type="button"
                  aria-label={`Agregar una unidad de ${line.title}`}
                  disabled={line.qty >= MAX_LINE_QTY}
                  onClick={() => setCartQty(slug, line.id, line.qty + 1)}
                  className="flex h-full w-9 items-center justify-center text-ink-2 hover:text-ink active:scale-[0.97] disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="tabular w-24 text-right text-[15px] font-medium text-ink">
                {formatCurrency(line.price * line.qty)}
              </p>
            </li>
          ))}
        </ul>

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-2">Total estimado</span>
            <span className="tabular font-display text-[28px] leading-none text-ink">{formatCurrency(total)}</span>
          </div>
          <p className="mt-2 text-[13px] text-ink-3">
            {businessName} confirma precios y disponibilidad por WhatsApp. Esta lista no se guarda en ningún servidor.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Enviar por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              clearCart(slug);
              dialogRef.current?.close();
            }}
            className="mt-2 h-10 w-full text-sm text-ink-3 transition-colors hover:text-ink"
          >
            Vaciar lista
          </button>
        </div>
      </dialog>
    </>
  );
}

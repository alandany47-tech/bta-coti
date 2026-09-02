"use client";

import { Trash2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { QuoteItem } from "@/lib/types";

export function QuoteItemsTable({
  items,
  onChangeQuantity,
  onChangePrice,
  onRemove,
}: {
  items: QuoteItem[];
  onChangeQuantity: (productId: string, quantity: number) => void;
  onChangePrice: (productId: string, price: number) => void;
  onRemove: (productId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle p-10 text-sm text-muted">
        Agrega productos con el buscador para armar la cotización.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium">Cantidad</th>
            <th className="px-4 py-3 font-medium">Precio unitario</th>
            <th className="px-4 py-3 font-medium">Subtotal</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.product_id}
              className="border-b border-border-subtle last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-xs text-muted">{item.sku}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    onChangeQuantity(
                      item.product_id,
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                  className="w-20"
                />
              </td>
              <td className="px-4 py-3">
                {item.is_custom_price ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      onChangePrice(
                        item.product_id,
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className="w-28"
                  />
                ) : (
                  <span className="flex items-center gap-1.5 text-foreground-muted">
                    <Lock className="h-3.5 w-3.5" />
                    {formatCurrency(item.unit_price)}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-foreground">
                {formatCurrency(item.unit_price * item.quantity)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(item.product_id)}
                  className="text-muted transition-colors hover:text-red-400"
                  aria-label={`Eliminar ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

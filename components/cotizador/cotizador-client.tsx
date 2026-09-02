"use client";

import { useMemo, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { ProductCombobox } from "@/components/cotizador/product-combobox";
import { QuoteItemsTable } from "@/components/cotizador/quote-items-table";
import { ClientInfoForm, type ClientInfo } from "@/components/cotizador/client-info-form";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Product, QuoteItem } from "@/lib/types";

export function CotizadorClient({
  tenantSlug,
  products,
}: {
  tenantSlug: string;
  products: Product[];
}) {
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [client, setClient] = useState<ClientInfo>({
    name: "",
    countryCode: "+52",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [items],
  );

  function handleAddProduct(product: Product) {
    setItems((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          unit_price: product.price,
          quantity: 1,
          is_custom_price: product.is_custom_price,
        },
      ];
    });
  }

  function handleChangeQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity } : item,
      ),
    );
  }

  function handleChangePrice(productId: string, unit_price: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, unit_price } : item,
      ),
    );
  }

  function handleRemove(productId: string) {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }

  const canSubmit =
    items.length > 0 && client.name.trim() && client.phone.trim() && !isSubmitting;

  async function handleGenerateAndSend() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/${tenantSlug}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: client.name.trim(),
          clientPhone: `${client.countryCode}${client.phone.trim()}`,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? "No se pudo generar la cotización.");
        return;
      }

      window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
      setItems([]);
      setClient({ name: "", countryCode: client.countryCode, phone: "" });
    } catch {
      setErrorMessage("Error de red al generar la cotización.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <ProductCombobox products={products} onSelect={handleAddProduct} />

      <QuoteItemsTable
        items={items}
        onChangeQuantity={handleChangeQuantity}
        onChangePrice={handleChangePrice}
        onRemove={handleRemove}
      />

      <div className="rounded-lg border border-border-subtle bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Datos del cliente
        </h2>
        <ClientInfoForm value={client} onChange={setClient} />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-400">{errorMessage}</p>
      )}

      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 border-t border-border-subtle bg-background/95 py-4 backdrop-blur">
        <div>
          <p className="text-xs text-muted">Total</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(total)}
          </p>
        </div>
        <Button
          size="lg"
          disabled={!canSubmit}
          onClick={handleGenerateAndSend}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Generar PDF y enviar por WhatsApp
        </Button>
      </div>
    </div>
  );
}

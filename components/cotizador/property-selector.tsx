"use client";

import { Building2 } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import type { Property } from "@/lib/types";

const STATUS_LABEL: Record<Property["status"], string> = {
  available: "Disponible",
  reserved: "Apartado",
  sold: "Vendido",
};

const STATUS_DOT: Record<Property["status"], string> = {
  available: "bg-emerald-500",
  reserved: "bg-amber-500",
  sold: "bg-red-500",
};

export function PropertySelector({
  properties,
  selectedId,
  onSelect,
}: {
  properties: Property[];
  selectedId: string | null;
  onSelect: (property: Property) => void;
}) {
  if (properties.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle p-10 text-sm text-muted">
        Todavía no hay propiedades en la cartera. Impórtalas desde el panel de
        catálogo.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        Cartera ({properties.length})
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => {
          const isSelected = property.id === selectedId;
          const pricePerM2 =
            property.m2_total > 0 ? property.list_price / property.m2_total : 0;

          return (
            <button
              key={property.id}
              type="button"
              onClick={() => onSelect(property)}
              className={cn(
                "flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
                isSelected
                  ? "border-foreground bg-surface-hover"
                  : "border-border-subtle bg-surface hover:border-foreground-muted",
              )}
            >
              <div className="relative h-36 w-full bg-background">
                {property.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={property.images[0]}
                    alt={property.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted" />
                  </div>
                )}
                <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 backdrop-blur">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      STATUS_DOT[property.status],
                    )}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-foreground-muted">
                    {STATUS_LABEL[property.status]}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1 p-3">
                <span className="text-sm font-medium text-foreground">
                  {property.title}
                </span>
                <span className="text-xs text-muted">
                  Unidad {property.unit_number} · {property.m2_total} m²
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(property.list_price)}
                  </span>
                  {pricePerM2 > 0 && (
                    <span className="text-[11px] text-muted">
                      {formatCurrency(pricePerM2)}/m²
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

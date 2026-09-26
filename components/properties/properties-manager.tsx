"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { PropertyMediaUploader } from "@/components/properties/property-media-uploader";
import type { Property } from "@/lib/types";

const STATUS_LABEL: Record<Property["status"], string> = {
  available: "Disponible",
  reserved: "Apartado",
  sold: "Vendido",
};

export function PropertiesManager({
  tenantSlug,
  initialProperties,
  initialMediaIds,
}: {
  tenantSlug: string;
  initialProperties: Property[];
  initialMediaIds: Record<string, string>;
}) {
  const [properties, setProperties] = useState(initialProperties);
  const [mediaIds, setMediaIds] = useState(initialMediaIds);

  function handleUpdate(updated: Property, ids?: Record<string, string>) {
    setProperties((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    if (ids) setMediaIds(ids);
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle p-10 text-sm text-muted">
        Todavía no hay propiedades. Impórtalas desde{" "}
        <span className="mx-1 text-foreground">Importar cartera</span> y
        vuelve aquí para agregar fotos y plano.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {properties.map((property) => (
        <div
          key={property.id}
          className="rounded-lg border border-border-subtle bg-surface p-4"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {property.title}
              </h3>
              <p className="text-xs text-muted">
                Unidad {property.unit_number} · {property.m2_total} m² ·{" "}
                {formatCurrency(property.list_price)} ·{" "}
                {STATUS_LABEL[property.status]}
              </p>
            </div>
          </div>

          <PropertyMediaUploader
            tenantSlug={tenantSlug}
            property={property}
            mediaIds={mediaIds}
            onUpdate={handleUpdate}
          />
        </div>
      ))}
    </div>
  );
}

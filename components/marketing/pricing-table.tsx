"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatCurrency, formatBytes } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type PublicPlan = {
  code: string;
  name: string;
  priceMonth: number;
  priceYear: number;
  limits: {
    items?: number | null;
    properties?: number | null;
    storage_bytes?: number | null;
    users?: number | null;
    templates?: number | null;
  };
  sort: number;
};

const HIGHLIGHT_CODE = "broker";

const UNIT_FORMS: Record<string, { singular: string; plural: string; unlimited: string }> = {
  propiedades: { singular: "propiedad", plural: "propiedades", unlimited: "propiedades ilimitadas" },
  ítems: { singular: "ítem", plural: "ítems", unlimited: "ítems ilimitados" },
  usuarios: { singular: "usuario", plural: "usuarios", unlimited: "usuarios ilimitados" },
  plantillas: { singular: "plantilla", plural: "plantillas", unlimited: "plantillas ilimitadas" },
};

function limitLabel(value: number | null | undefined, unit: string) {
  const forms = UNIT_FORMS[unit];
  if (value === null || value === undefined) return forms?.unlimited ?? `${unit} ilimitados`;
  if (value === 1) return `1 ${forms?.singular ?? unit}`;
  return `${value} ${forms?.plural ?? unit}`;
}

// Qué hace cada plan hoy (no solo cuotas) — basado en lo que de verdad está construido
// por módulo: el cotizador con WhatsApp/PDF/mini-CRM solo existe para "broker" (T14/T15);
// servicios y catálogo hoy solo tienen el catálogo público de lectura, su cotización
// está "en camino" (ver app/servicios, app/catalogo). No prometer aquí lo que esas
// páginas no prometen.
const PLAN_FEATURES: Record<string, string[]> = {
  esencial: [
    "Catálogo de servicios y materiales por categoría",
    "Página pública compartible con un link",
    "Cotización multilínea — en camino",
  ],
  catalogo: [
    "Catálogo de productos y de servicios por categoría",
    "Página pública compartible con un link",
    "Cotización y envío por WhatsApp — en camino",
  ],
  broker: [
    "Cotiza propiedades con enganche y mensualidades",
    "Envía la cotización por WhatsApp con PDF",
    "Mini-CRM y catálogo de servicios incluido",
  ],
  broker_pro: [
    "Todo lo de Broker, más catálogo de productos",
    "Para carteras e inventarios más grandes",
  ],
};

export function PricingTable({ plans }: { plans: PublicPlan[] }) {
  const [interval, setInterval] = useState<"month" | "year">("month");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-line text-sm">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cn("px-4 py-2", interval === "month" ? "bg-ink text-paper" : "bg-surface text-ink-2")}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cn("px-4 py-2", interval === "year" ? "bg-ink text-paper" : "bg-surface text-ink-2")}
          >
            Anual
          </button>
        </div>
        {interval === "year" ? <span className="text-sm text-ok">2 meses gratis</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const price = interval === "month" ? plan.priceMonth : plan.priceYear;
          const isHighlighted = plan.code === HIGHLIGHT_CODE;
          const itemsLimit = plan.limits.properties && plan.limits.properties > 0 ? plan.limits.properties : plan.limits.items;
          const itemsUnit = plan.limits.properties && plan.limits.properties > 0 ? "propiedades" : "ítems";
          const quotaSummary = [
            limitLabel(itemsLimit, itemsUnit),
            plan.limits.storage_bytes ? formatBytes(plan.limits.storage_bytes) : "almacenamiento ilimitado",
            limitLabel(plan.limits.users, "usuarios"),
            limitLabel(plan.limits.templates, "plantillas"),
          ].join(" · ");

          return (
            <div
              key={plan.code}
              className={cn(
                "flex flex-col gap-4 rounded-xl border bg-surface p-6",
                isHighlighted ? "border-2 border-ink" : "border-line",
              )}
            >
              <div>
                <p className="font-medium text-ink">{plan.name}</p>
                <p className="mt-2 font-display text-[24px] font-medium text-ink">
                  {formatCurrency(price)}
                  <span className="text-sm font-sans font-normal text-ink-2">/{interval === "month" ? "mes" : "año"}</span>
                </p>
              </div>

              <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                {(PLAN_FEATURES[plan.code] ?? []).map((feature) => {
                  const pending = feature.includes("en camino");
                  return (
                    <li key={feature} className={cn("flex items-start gap-2 text-ink-2", pending && "italic")}>
                      <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", pending ? "bg-ink-3" : "bg-accent")} />
                      {feature}
                    </li>
                  );
                })}
              </ul>

              <p className="text-xs text-ink-2">{quotaSummary}</p>

              <Link
                href={`/registro?plan=${plan.code}`}
                className={buttonVariants({ variant: isHighlighted ? "default" : "secondary" })}
              >
                Elegir {plan.name}
              </Link>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-ink-2">Paga con tarjeta o transferencia SPEI. Precios en MXN.</p>
    </div>
  );
}

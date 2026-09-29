"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Plan = { code: string; name: string; priceMonth: number; priceYear: number; sort: number };
type Overage = { key: string; used: number; allowed: number };

const OVERAGE_LABEL: Record<string, string> = {
  items: "ítems",
  properties: "propiedades",
  storage_bytes: "almacenamiento",
  users: "usuarios",
};

export function PlanPicker({
  tenantSlug,
  plans,
  currentPlanCode,
  hasSubscription,
}: {
  tenantSlug: string;
  plans: Plan[];
  currentPlanCode: string | null;
  hasSubscription: boolean;
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "spei">("card");
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overages, setOverages] = useState<Overage[] | null>(null);

  if (hasSubscription) {
    return (
      <p className="text-sm text-ink-2">
        Ya tienes una suscripción activa. Para cambiar de plan, usa el portal de facturación de arriba.
      </p>
    );
  }

  async function choose(planCode: string) {
    setPendingPlan(planCode);
    setError(null);
    setOverages(null);
    try {
      const response = await fetch(`/api/${tenantSlug}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planCode, interval, payment_method: paymentMethod }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.overages) setOverages(payload.overages as Overage[]);
        throw new Error(payload.error ?? "No se pudo iniciar el pago.");
      }
      window.location.assign(payload.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setPendingPlan(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex overflow-hidden rounded-md border border-border-subtle text-sm">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={`px-3 py-1.5 ${interval === "month" ? "bg-foreground text-background" : "bg-surface text-foreground-muted"}`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={`px-3 py-1.5 ${interval === "year" ? "bg-foreground text-background" : "bg-surface text-foreground-muted"}`}
          >
            Anual
          </button>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border-subtle text-sm">
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`px-3 py-1.5 ${paymentMethod === "card" ? "bg-foreground text-background" : "bg-surface text-foreground-muted"}`}
          >
            Tarjeta
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("spei")}
            className={`px-3 py-1.5 ${paymentMethod === "spei" ? "bg-foreground text-background" : "bg-surface text-foreground-muted"}`}
          >
            SPEI (transferencia)
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans
          .slice()
          .sort((a, b) => a.sort - b.sort)
          .map((plan) => {
            const price = interval === "month" ? plan.priceMonth : plan.priceYear;
            const isCurrent = plan.code === currentPlanCode;
            return (
              <div key={plan.code} className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-foreground">{plan.name}</span>
                  <span className="text-sm text-foreground-muted">
                    {formatCurrency(price)}/{interval === "month" ? "mes" : "año"}
                  </span>
                </div>
                {isCurrent ? (
                  <span className="text-xs text-foreground-muted">Tu plan actual</span>
                ) : (
                  <Button type="button" size="sm" disabled={pendingPlan === plan.code} onClick={() => choose(plan.code)}>
                    {pendingPlan === plan.code ? "Redirigiendo..." : "Elegir"}
                  </Button>
                )}
              </div>
            );
          })}
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {overages && overages.length > 0 ? (
        <div className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          <p className="font-medium">Ese plan no alcanza para tu uso actual:</p>
          <ul className="mt-1 list-disc pl-5">
            {overages.map((o) => (
              <li key={o.key}>
                Tienes {o.used} {OVERAGE_LABEL[o.key] ?? o.key}; el plan permite {o.allowed}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanForm } from "@/components/admin/plan-form";
import { formatCurrency } from "@/lib/utils";
import type { Plan } from "@/lib/plans-shared";

const MODULE_LABEL: Record<string, string> = { services: "Servicios", catalog: "Catálogo", broker: "Broker" };

export function PlanesConsole({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function upsert(plan: Plan) {
    setPlans((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      const next = exists ? prev.map((p) => (p.id === plan.id ? plan : p)) : [...prev, plan];
      return [...next].sort((a, b) => a.sort - b.sort);
    });
    setCreating(false);
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <PlanForm onSaved={upsert} onCancel={() => setCreating(false)} />
      ) : (
        <Button onClick={() => setCreating(true)} className="self-start">
          Nuevo plan
        </Button>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full text-left">
          <thead className="border-b border-border-subtle text-xs text-muted">
            <tr>
              <th className="p-3">Código</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Mensual</th>
              <th className="p-3">Anual</th>
              <th className="p-3">Módulos</th>
              <th className="p-3">Público</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) =>
              editingId === plan.id ? (
                <tr key={plan.id}>
                  <td colSpan={7} className="p-3">
                    <PlanForm plan={plan} onSaved={upsert} onCancel={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={plan.id} className="border-b border-border-subtle last:border-0">
                  <td className="p-3 text-sm font-medium text-foreground">{plan.code}</td>
                  <td className="p-3 text-sm text-foreground-muted">{plan.name}</td>
                  <td className="p-3 text-sm text-foreground-muted tabular">{formatCurrency(plan.price_month)}</td>
                  <td className="p-3 text-sm text-foreground-muted tabular">{formatCurrency(plan.price_year)}</td>
                  <td className="p-3 text-sm text-foreground-muted">
                    {plan.modules.map((m) => MODULE_LABEL[m] ?? m).join(", ") || "—"}
                  </td>
                  <td className="p-3 text-sm text-foreground-muted">{plan.public ? "Sí" : "Oculto"}</td>
                  <td className="p-3">
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(plan.id)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

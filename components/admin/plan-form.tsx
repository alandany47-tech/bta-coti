"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIMIT_FIELDS, PLAN_MODULES, type Plan } from "@/lib/plans-shared";

const LIMIT_LABEL: Record<string, string> = {
  items: "Ítems",
  properties: "Propiedades",
  storage_bytes: "Almacenamiento (bytes)",
  users: "Usuarios",
  templates: "Plantillas",
  images_per_item: "Imágenes por ítem",
  plans_per_item: "Planes de pago por ítem",
  quotes_per_day: "Cotizaciones por día",
};

const MODULE_LABEL: Record<string, string> = { services: "Servicios", catalog: "Catálogo", broker: "Broker" };

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground-muted">
      {label}
      {children}
    </label>
  );
}

/** Crear o editar un plan (docs/ADMIN-PANEL.md §2). `plan` presente = edición, prefil de todo. */
export function PlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: Plan;
  onSaved: (plan: Plan) => void;
  onCancel: () => void;
}) {
  const [modules, setModules] = useState<Set<string>>(new Set(plan?.modules ?? []));
  const [isPublic, setIsPublic] = useState(plan?.public ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const limits: Record<string, string> = {};
    for (const field of LIMIT_FIELDS) limits[field] = String(form.get(`limit_${field}`) ?? "");

    setPending(true);
    setError(null);
    try {
      const body = {
        code: form.get("code"),
        name: form.get("name"),
        price_month: form.get("price_month"),
        price_year: form.get("price_year"),
        stripe_price_month: form.get("stripe_price_month"),
        stripe_price_year: form.get("stripe_price_year"),
        sort: form.get("sort"),
        modules: [...modules],
        public: isPublic,
        limits,
      };
      const response = await fetch(plan ? `/api/admin/plans/${plan.id}` : "/api/admin/plans", {
        method: plan ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar el plan.");
      onSaved(payload.plan as Plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setPending(false);
    }
  }

  function toggleModule(mod: string) {
    setModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border-subtle bg-surface p-4 sm:grid-cols-3">
      <Labeled label="Código">
        <Input name="code" required defaultValue={plan?.code} autoCapitalize="none" spellCheck={false} />
      </Labeled>
      <Labeled label="Nombre">
        <Input name="name" required maxLength={60} defaultValue={plan?.name} />
      </Labeled>
      <Labeled label="Orden (menor = primero)">
        <Input name="sort" type="number" min={0} defaultValue={plan?.sort ?? 0} />
      </Labeled>
      <Labeled label="Precio mensual (MXN)">
        <Input name="price_month" type="number" min={0} step="0.01" defaultValue={plan?.price_month ?? 0} />
      </Labeled>
      <Labeled label="Precio anual (MXN)">
        <Input name="price_year" type="number" min={0} step="0.01" defaultValue={plan?.price_year ?? 0} />
      </Labeled>
      <div />
      <Labeled label="Stripe price ID (mensual)">
        <Input name="stripe_price_month" defaultValue={plan?.stripe_price_month ?? ""} placeholder="price_..." />
      </Labeled>
      <Labeled label="Stripe price ID (anual)">
        <Input name="stripe_price_year" defaultValue={plan?.stripe_price_year ?? ""} placeholder="price_..." />
      </Labeled>
      <label className="flex items-center gap-2 self-end text-xs font-medium text-foreground-muted">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Público (visible para elegir)
      </label>

      <fieldset className="col-span-full flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground-muted">Módulos</span>
        <div className="flex gap-4">
          {PLAN_MODULES.map((mod) => (
            <label key={mod} className="flex items-center gap-1.5 text-sm text-foreground">
              <input type="checkbox" checked={modules.has(mod)} onChange={() => toggleModule(mod)} />
              {MODULE_LABEL[mod]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="col-span-full grid gap-3 sm:grid-cols-4">
        <legend className="text-xs font-medium text-foreground-muted">Límites (vacío = ilimitado)</legend>
        {LIMIT_FIELDS.map((field) => (
          <Labeled key={field} label={LIMIT_LABEL[field]}>
            <Input
              name={`limit_${field}`}
              type="number"
              min={0}
              defaultValue={plan?.limits?.[field] ?? ""}
              placeholder="Ilimitado"
            />
          </Labeled>
        ))}
      </fieldset>

      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : plan ? "Guardar cambios" : "Crear plan"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { normalizeSlugInput } from "@/lib/auth/register-schema";
import type { AdminTenantRow } from "@/lib/types";

const PLANS = [
  ["esencial", "Esencial"],
  ["catalogo", "Catálogo"],
  ["broker", "Broker"],
  ["broker_pro", "Broker Pro"],
] as const;

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground-muted">
      {label}
      {children}
    </label>
  );
}

export function NewClientForm({
  rootDomain,
  onCreated,
  onCancel,
}: {
  rootDomain: string;
  onCreated: (tenant: AdminTenantRow) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<"trialing" | "active">("trialing");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setDone(null);
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo crear el cliente.");
      onCreated(payload.tenant as AdminTenantRow);
      setDone(
        payload.invited
          ? "Cliente creado. Enviamos la invitación al correo del dueño."
          : "Cliente creado. El correo ya tenía cuenta: entra con su contraseña actual.",
      );
      (event.target as HTMLFormElement).reset();
      setStatus("trialing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-border-subtle bg-surface p-4 sm:grid-cols-2">
      <Labeled label="Negocio">
        <Input name="name" required maxLength={80} />
      </Labeled>
      <Labeled label={`Subdominio (.${rootDomain})`}>
        <Input
          name="slug"
          required
          autoCapitalize="none"
          spellCheck={false}
          onBlur={(event) => (event.target.value = normalizeSlugInput(event.target.value))}
        />
      </Labeled>
      <Labeled label="Correo del dueño">
        <Input name="ownerEmail" type="email" required />
      </Labeled>
      <Labeled label="Plan">
        <Select name="plan" defaultValue="broker">
          {PLANS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </Select>
      </Labeled>
      <Labeled label="Estado inicial">
        <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as "trialing" | "active")}>
          <option value="trialing">En prueba</option>
          <option value="active">Activo</option>
        </Select>
      </Labeled>
      {status === "trialing" ? (
        <Labeled label="Días de prueba">
          <Input name="trialDays" type="number" min={1} max={90} defaultValue={7} required />
        </Labeled>
      ) : (
        <div />
      )}
      <Labeled label="Cobro">
        <Select name="billingMode" defaultValue="stripe">
          <option value="stripe">Stripe</option>
          <option value="manual">Manual (fuera de Stripe)</option>
        </Select>
      </Labeled>
      <Labeled label="Notas internas (opcional)">
        <Input name="notes" maxLength={5000} />
      </Labeled>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear e invitar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cerrar
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {done ? <p className="text-sm text-ok">{done}</p> : null}
      </div>
    </form>
  );
}

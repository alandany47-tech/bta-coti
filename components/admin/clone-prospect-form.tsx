"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeSlugInput } from "@/lib/auth/register-schema";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground-muted">
      {label}
      {children}
    </label>
  );
}

export function CloneProspectForm({
  tenantId,
  rootDomain,
  onDone,
  onCancel,
}: {
  tenantId: string;
  rootDomain: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo clonar la demo.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-border-subtle bg-surface p-4 sm:grid-cols-3">
      <Labeled label="Nombre del prospecto">
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
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Clonando..." : "Clonar como prueba de 7 días"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </form>
  );
}

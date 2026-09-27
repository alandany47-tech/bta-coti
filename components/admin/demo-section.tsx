"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloneProspectForm } from "@/components/admin/clone-prospect-form";
import type { AdminDemoTenantRow } from "@/lib/admin-tenants";

export function DemoSection({
  initialTenants,
  rootDomain,
}: {
  initialTenants: AdminDemoTenantRow[];
  rootDomain: string;
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  async function handleReset() {
    if (!window.confirm("¿Resetear la demo? Esto borra cualquier cambio hecho por visitantes en los 8 tenants de demo.")) return;
    setResetting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/reset-demo", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo resetear la demo.");
      setTenants(payload.tenants as AdminDemoTenantRow[]);
      setMessage("Demo reseteada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <details className="rounded-lg border border-border-subtle bg-surface">
      <summary className="cursor-pointer select-none p-4 text-sm font-medium text-foreground">
        Demo ({tenants.length} tenants)
      </summary>
      <div className="flex flex-col gap-3 border-t border-border-subtle p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={handleReset} disabled={resetting}>
            {resetting ? "Reseteando..." : "Resetear demo"}
          </Button>
          {message ? <span className="text-sm text-ok">{message}</span> : null}
          {error ? <span className="text-sm text-danger">{error}</span> : null}
        </div>

        <div className="overflow-x-auto rounded-md border border-border-subtle">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="p-2 font-medium">Nombre</th>
                <th className="p-2 font-medium">Subdominio</th>
                <th className="p-2 font-medium">Plan</th>
                <th className="p-2 font-medium">Estado</th>
                <th className="p-2 font-medium">Clonar</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="p-2 text-foreground">{tenant.name}</td>
                  <td className="p-2 text-foreground-muted">{tenant.slug}</td>
                  <td className="p-2 text-foreground-muted">{tenant.plan_name}</td>
                  <td className="p-2 text-foreground-muted">{tenant.status}</td>
                  <td className="p-2">
                    <Button size="sm" variant="secondary" onClick={() => setCloningId(tenant.id)}>
                      Clonar como prospecto
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cloningId ? (
          <CloneProspectForm
            tenantId={cloningId}
            rootDomain={rootDomain}
            onCancel={() => setCloningId(null)}
            onDone={() => {
              setCloningId(null);
              setMessage("Prospecto creado en prueba de 7 días.");
            }}
          />
        ) : null}
      </div>
    </details>
  );
}

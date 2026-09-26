"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NewClientForm } from "@/components/admin/new-client-form";
import { TenantRow } from "@/components/admin/tenant-row";
import type { AdminTenantRow } from "@/lib/types";

export function AdminConsole({
  initialTenants,
  rootDomain,
}: {
  initialTenants: AdminTenantRow[];
  rootDomain: string;
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const [creating, setCreating] = useState(false);

  function handleUpdate(updated: AdminTenantRow) {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{tenants.length} clientes</p>
        {creating ? null : <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
      </div>

      {creating ? (
        <NewClientForm
          rootDomain={rootDomain}
          onCreated={(tenant) => setTenants((prev) => [tenant, ...prev])}
          onCancel={() => setCreating(false)}
        />
      ) : null}

      {tenants.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle p-10 text-sm text-muted">
          Todavía no hay clientes. Crea el primero con «Nuevo cliente».
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <th className="p-3 font-medium">Logo</th>
                <th className="p-3 font-medium">Nombre</th>
                <th className="p-3 font-medium">Subdominio</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Origen</th>
                <th className="p-3 text-center font-medium">Propiedades</th>
                <th className="p-3 text-center font-medium">Cotiz. del mes</th>
                <th className="p-3 font-medium">Cambiar estado</th>
                <th className="p-3 font-medium">Notas internas</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <TenantRow key={tenant.id} tenant={tenant} rootDomain={rootDomain} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
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

  function handleUpdate(updated: AdminTenantRow) {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (tenants.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border-subtle p-10 text-sm text-muted">
        Todavía no hay tenants registrados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <th className="p-3 font-medium">Logo</th>
            <th className="p-3 font-medium">Nombre</th>
            <th className="p-3 font-medium">Subdominio</th>
            <th className="p-3 font-medium">Estado</th>
            <th className="p-3 text-center font-medium">Propiedades</th>
            <th className="p-3 text-center font-medium">Cotizaciones</th>
            <th className="p-3 font-medium">Cambiar estado</th>
            <th className="p-3 font-medium">Notas internas</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <TenantRow
              key={tenant.id}
              tenant={tenant}
              rootDomain={rootDomain}
              onUpdate={handleUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

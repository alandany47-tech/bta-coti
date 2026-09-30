"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [tenants, setTenants] = useState(initialTenants);
  const [creating, setCreating] = useState(false);
  // `key` en el Server Component ya remonta esto al cambiar de página/filtro; este par cubre el otro
  // caso, `router.refresh()` tras crear un cliente, donde el `key` no cambia pero sí los datos —
  // ajustar el estado durante el render (no en un efecto) evita el re-render en cascada que marca
  // react-hooks/set-state-in-effect.
  const [prevInitialTenants, setPrevInitialTenants] = useState(initialTenants);
  if (initialTenants !== prevInitialTenants) {
    setPrevInitialTenants(initialTenants);
    setTenants(initialTenants);
  }

  function handleUpdate(updated: AdminTenantRow) {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <>
      <div className="flex items-center justify-end">
        {creating ? null : <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
      </div>

      {creating ? (
        <NewClientForm
          rootDomain={rootDomain}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
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
                <th className="p-3 font-medium">Almacenamiento</th>
                <th className="p-3 text-center font-medium">Ítems</th>
                <th className="p-3 text-center font-medium">Cotiz. del mes</th>
                <th className="p-3 font-medium">Alta</th>
                <th className="p-3 font-medium">Vencimiento</th>
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

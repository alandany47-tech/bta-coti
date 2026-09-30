"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL } from "@/components/admin/status-badge";
import type { AdminTenantRow, TenantStatus } from "@/lib/types";

const ALL_STATUSES = Object.keys(STATUS_LABEL) as TenantStatus[];
const NEEDS_REASON: TenantStatus[] = ["suspended", "canceled"];

/**
 * Select de estado + motivo obligatorio para suspender/cancelar (docs/ADMIN-PANEL.md §3). Extraído
 * de `TenantRow` (T24a) para reusarlo también en el Cliente-detalle (T24b) sin duplicar la lógica.
 */
export function StatusChanger({
  tenant,
  onUpdate,
  className,
}: {
  tenant: AdminTenantRow;
  onUpdate: (updated: AdminTenantRow) => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TenantStatus | null>(null);
  const [reason, setReason] = useState("");

  function handleSelect(status: TenantStatus) {
    if (status === tenant.status) return;
    if (NEEDS_REASON.includes(status)) {
      setPendingStatus(status);
      setReason("");
      return;
    }
    void handleStatusChange(status, "");
  }

  async function handleStatusChange(status: TenantStatus, statusReason: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: statusReason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el tenant.");
      setPendingStatus(null);
      onUpdate({ ...tenant, ...payload.tenant });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <Select
        value={tenant.status}
        disabled={saving}
        onChange={(event) => handleSelect(event.target.value as TenantStatus)}
        className="h-8 text-xs"
      >
        {ALL_STATUSES.filter((status) => status !== "trialing" || tenant.status === "trialing").map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </Select>
      {pendingStatus ? (
        <div className="mt-2 flex min-w-[220px] flex-col gap-1.5">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`Motivo para pasar a ${STATUS_LABEL[pendingStatus].toLowerCase()}`}
            className="h-8 w-full rounded-md border border-border-subtle bg-surface px-2 text-xs text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!reason.trim() || saving} onClick={() => handleStatusChange(pendingStatus, reason.trim())}>
              {saving ? "..." : "Confirmar"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPendingStatus(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

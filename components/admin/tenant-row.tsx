"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge, STATUS_LABEL } from "@/components/admin/status-badge";
import type { AdminTenantRow, TenantStatus } from "@/lib/types";

const ALL_STATUSES = Object.keys(STATUS_LABEL) as TenantStatus[];
const NEEDS_REASON: TenantStatus[] = ["suspended", "canceled"];
const SOURCE_LABEL = { self_signup: "Registro", admin: "Admin", demo_clone: "Demo" } as const;

/** Nunca cambia después del mount: alcanza con un subscribe no-op. */
function subscribeToNothing() {
  return () => {};
}

/**
 * Refleja el host actual (protocolo + puerto) en local; usa el dominio raíz
 * en prod. Vía useSyncExternalStore (con getServerSnapshot) en vez de
 * useState+useEffect: leer `window.location` durante el render causaría un
 * hydration mismatch (SSR no tiene `window`), y "corregirlo" con setState
 * dentro de un efecto es el anti-patrón que react-hooks/set-state-in-effect
 * marca como error — este hook es la vía que React sí sanciona para valores
 * que legítimamente difieren entre servidor y cliente.
 */
function useTenantUrl(slug: string, rootDomain: string) {
  return useSyncExternalStore(
    subscribeToNothing,
    () => {
      const { protocol, hostname, port } = window.location;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `${protocol}//${slug}.localhost${port ? `:${port}` : ""}`;
      }
      return `${protocol}//${slug}.${rootDomain}`;
    },
    () => `https://${slug}.${rootDomain}`,
  );
}

export function TenantRow({
  tenant,
  rootDomain,
  onUpdate,
}: {
  tenant: AdminTenantRow;
  rootDomain: string;
  onUpdate: (updated: AdminTenantRow) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(tenant.notes ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TenantStatus | null>(null);
  const [reason, setReason] = useState("");
  const tenantUrl = useTenantUrl(tenant.slug, rootDomain);

  const notesDirty = notesDraft !== (tenant.notes ?? "");

  async function patchTenant(body: Record<string, unknown>) {
    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo actualizar el tenant.");
    }
    return payload.tenant as AdminTenantRow;
  }

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
    setSavingStatus(true);
    setError(null);
    try {
      const updated = await patchTenant({ status, reason: statusReason });
      setPendingStatus(null);
      onUpdate({ ...tenant, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true);
    setError(null);
    try {
      const updated = await patchTenant({ notes: notesDraft });
      onUpdate({ ...tenant, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="p-3">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="h-8 w-8 rounded object-contain"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded text-xs font-semibold text-background"
            style={{ backgroundColor: tenant.brand_color }}
          >
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
      </td>
      <td className="p-3 text-sm font-medium text-foreground">{tenant.name}</td>
      <td className="p-3">
        <a
          href={tenantUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground"
        >
          {tenant.slug}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </td>
      <td className="p-3 text-sm text-foreground-muted">{tenant.plan_name}</td>
      <td className="p-3">
        <StatusBadge status={tenant.status} />
        {tenant.status_reason ? (
          <p className="mt-0.5 max-w-[160px] truncate text-xs text-muted" title={tenant.status_reason}>
            {tenant.status_reason}
          </p>
        ) : null}
      </td>
      <td className="p-3 text-sm text-foreground-muted">
        {tenant.source ? SOURCE_LABEL[tenant.source] : "—"}
      </td>
      <td className="p-3 text-center text-sm text-foreground-muted tabular">{tenant.items_count}</td>
      <td className="p-3 text-center text-sm text-foreground-muted tabular">{tenant.quotes_month}</td>
      <td className="p-3">
        <Select
          value={tenant.status}
          disabled={savingStatus}
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
              <Button
                size="sm"
                disabled={!reason.trim() || savingStatus}
                onClick={() => handleStatusChange(pendingStatus, reason.trim())}
              >
                {savingStatus ? "..." : "Confirmar"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPendingStatus(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </td>
      <td className="p-3">
        <div className="flex min-w-[200px] items-center gap-2">
          <input
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Notas internas..."
            className="h-8 w-full rounded-md border border-border-subtle bg-surface px-2 text-xs text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!notesDirty || savingNotes}
            onClick={handleSaveNotes}
          >
            {savingNotes ? "..." : "Guardar"}
          </Button>
        </div>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </td>
    </tr>
  );
}

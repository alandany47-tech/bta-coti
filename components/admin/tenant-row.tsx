"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusChanger } from "@/components/admin/status-changer";
import { useTenantUrl } from "@/components/admin/use-tenant-url";
import { formatBytes } from "@/lib/utils";
import type { AdminTenantRow } from "@/lib/types";

const SOURCE_LABEL = { self_signup: "Registro", admin: "Admin", demo_clone: "Demo" } as const;
const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });

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
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantUrl = useTenantUrl(tenant.slug, rootDomain);

  const notesDirty = notesDraft !== (tenant.notes ?? "");

  async function handleSaveNotes() {
    setSavingNotes(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo actualizar el tenant.");
      onUpdate({ ...tenant, ...payload.tenant });
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
      <td className="p-3 text-sm font-medium text-foreground">
        <Link href={`/admin/clientes/${tenant.id}`} className="hover:underline">
          {tenant.name}
        </Link>
      </td>
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
      <td className="p-3">
        <div className="flex min-w-[110px] flex-col gap-1">
          <Progress value={tenant.storage_bytes} max={tenant.storage_limit} />
          <span className="text-xs text-muted tabular">
            {formatBytes(tenant.storage_bytes)}
            {tenant.storage_limit != null ? ` / ${formatBytes(tenant.storage_limit)}` : ""}
          </span>
        </div>
      </td>
      <td className="p-3 text-center text-sm text-foreground-muted tabular">{tenant.items_count}</td>
      <td className="p-3 text-center text-sm text-foreground-muted tabular">{tenant.quotes_month}</td>
      <td className="p-3 text-sm text-foreground-muted tabular">{dateFormat.format(new Date(tenant.created_at))}</td>
      <td className="p-3 text-sm text-foreground-muted tabular">
        {tenant.status === "trialing"
          ? tenant.trial_ends_at
            ? dateFormat.format(new Date(tenant.trial_ends_at))
            : "—"
          : tenant.current_period_end
            ? dateFormat.format(new Date(tenant.current_period_end))
            : "—"}
      </td>
      <td className="p-3">
        <StatusChanger tenant={tenant} onUpdate={onUpdate} />
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

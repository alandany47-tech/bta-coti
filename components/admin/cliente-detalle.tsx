"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatusChanger } from "@/components/admin/status-changer";
import { useTenantUrl } from "@/components/admin/use-tenant-url";
import { CopyLinkButton } from "@/components/quote/copy-link-button";
import { formatBytes } from "@/lib/utils";
import type { AdminTenantRow } from "@/lib/types";
import type { TenantMember } from "@/lib/admin-tenants";
import type { Plan } from "@/lib/plans-shared";
import type { AuditLogRow } from "@/lib/admin-audit";

const ROLE_LABEL: Record<TenantMember["role"], string> = { owner: "Dueño", editor: "Editor", viewer: "Solo lectura" };
const dateFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function postAction(url: string): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) return { ok: false, error: payload.error ?? "No se pudo completar la acción." };
    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: "Error de red." };
  }
}

export function ClienteDetalle({
  tenant: initialTenant,
  members,
  plans,
  history,
  rootDomain,
  stripeCustomerUrl,
  stripeSubscriptionUrl,
}: {
  tenant: AdminTenantRow;
  members: TenantMember[];
  plans: Plan[];
  history: { rows: AuditLogRow[]; total: number; page: number; pageSize: number };
  rootDomain: string;
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
}) {
  const [tenant, setTenant] = useState(initialTenant);
  const tenantUrl = useTenantUrl(tenant.slug, rootDomain);
  const router = useRouter();

  // Refresca el Server Component (historial, uso) además de actualizar el tenant en memoria:
  // toda acción de esta página deja una fila nueva en audit_log que el historial de abajo no vería
  // hasta recargar si no se pide un refresh explícito.
  function handleUpdate(updated: AdminTenantRow) {
    setTenant(updated);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded text-sm font-semibold text-background"
          style={{ backgroundColor: tenant.brand_color }}
        >
          {tenant.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">{tenant.name}</h1>
          <a href={tenantUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
            {tenant.slug} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="ml-auto">
          <StatusBadge status={tenant.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DatosCard
          tenant={tenant}
          members={members}
          stripeCustomerUrl={stripeCustomerUrl}
          stripeSubscriptionUrl={stripeSubscriptionUrl}
          onUpdate={handleUpdate}
        />
        <UsoCard tenant={tenant} />
      </div>

      <AccionesCard tenant={tenant} plans={plans} onUpdate={handleUpdate} />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4">
          <table className="w-full text-left">
            <thead className="border-b border-border-subtle text-xs text-muted">
              <tr>
                <th className="py-2">Fecha</th>
                <th className="py-2">Acción</th>
                <th className="py-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-sm text-muted">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                history.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 text-sm text-foreground-muted tabular">{dateTimeFormat.format(new Date(row.createdAt))}</td>
                    <td className="py-2 text-sm font-medium text-foreground">{row.action}</td>
                    <td className="py-2 text-sm text-foreground-muted">{row.actorEmail ?? "Automático"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            page={history.page}
            pageSize={history.pageSize}
            total={history.total}
            basePath={`/admin/clientes/${tenant.id}`}
            query={{}}
            label="registros"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function DatosCard({
  tenant,
  members,
  stripeCustomerUrl,
  stripeSubscriptionUrl,
  onUpdate,
}: {
  tenant: AdminTenantRow;
  members: TenantMember[];
  stripeCustomerUrl: string | null;
  stripeSubscriptionUrl: string | null;
  onUpdate: (tenant: AdminTenantRow) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(tenant.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesDirty = notesDraft !== (tenant.notes ?? "");

  async function handleSaveNotes() {
    setSavingNotes(true);
    setError(null);
    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "No se pudieron guardar las notas.");
    } else {
      onUpdate(payload.tenant);
    }
    setSavingNotes(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Plan</p>
          <p className="text-foreground">{tenant.plan_name}</p>
          {tenant.status_reason ? <p className="text-xs text-muted">Motivo: {tenant.status_reason}</p> : null}
        </div>
        <div>
          <p className="text-xs text-muted">Cobro</p>
          <p className="text-foreground">{tenant.billing_mode === "stripe" ? "Stripe" : "Manual (fuera de Stripe)"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Miembros</p>
          {members.length === 0 ? (
            <p className="text-foreground-muted">
              Sin miembros registrados (piloto anterior a las invitaciones — no tiene dueño en el sistema de auth).
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {members.map((m) => (
                <li key={m.userId} className="text-foreground">
                  {m.email ?? m.userId} <span className="text-xs text-muted">({ROLE_LABEL[m.role]})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {stripeCustomerUrl || stripeSubscriptionUrl ? (
          <div>
            <p className="text-xs text-muted">Stripe</p>
            <div className="flex flex-col gap-0.5">
              {stripeCustomerUrl ? (
                <a href={stripeCustomerUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Cliente en Stripe
                </a>
              ) : null}
              {stripeSubscriptionUrl ? (
                <a href={stripeSubscriptionUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Suscripción en Stripe
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-xs text-muted">Notas internas</p>
          <div className="flex items-center gap-2">
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              placeholder="Notas internas..."
              rows={2}
              className="w-full rounded-md border border-border-subtle bg-surface px-2 py-1.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-muted"
            />
            <Button size="sm" variant="secondary" disabled={!notesDirty || savingNotes} onClick={handleSaveNotes}>
              {savingNotes ? "..." : "Guardar"}
            </Button>
          </div>
          {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function UsoCard({ tenant }: { tenant: AdminTenantRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso (mes en curso)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div>
          <p className="text-xs text-muted">Almacenamiento</p>
          <Progress value={tenant.storage_bytes} max={tenant.storage_limit} />
          <p className="text-xs text-muted tabular">
            {formatBytes(tenant.storage_bytes)}
            {tenant.storage_limit != null ? ` / ${formatBytes(tenant.storage_limit)}` : ""}
          </p>
        </div>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted">Ítems</p>
            <p className="text-foreground tabular">{tenant.items_count}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Cotizaciones del mes</p>
            <p className="text-foreground tabular">{tenant.quotes_month}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Alta</p>
            <p className="text-foreground tabular">{dateFormat.format(new Date(tenant.created_at))}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Vencimiento</p>
            <p className="text-foreground tabular">
              {tenant.status === "trialing"
                ? tenant.trial_ends_at
                  ? dateFormat.format(new Date(tenant.trial_ends_at))
                  : "—"
                : tenant.current_period_end
                  ? dateFormat.format(new Date(tenant.current_period_end))
                  : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AccionesCard({
  tenant,
  plans,
  onUpdate,
}: {
  tenant: AdminTenantRow;
  plans: Plan[];
  onUpdate: (tenant: AdminTenantRow) => void;
}) {
  // "trial" nunca se asigna a un tenant real (comentario de la columna en 0004_foundation.sql;
  // provision_tenant la excluye explícitamente al resolver el plan).
  const assignablePlans = plans.filter((p) => p.code !== "trial");
  const [planCode, setPlanCode] = useState(assignablePlans.find((p) => p.name === tenant.plan_name)?.code ?? assignablePlans[0]?.code ?? "");
  const [savingPlan, setSavingPlan] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [savingExtend, setSavingExtend] = useState(false);
  const [reinviting, setReinviting] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [generatingCheckout, setGeneratingCheckout] = useState(false);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
  const [generatingSupport, setGeneratingSupport] = useState(false);
  const [message, setMessage] = useState<{ text: string; danger?: boolean } | null>(null);

  async function handleChangePlan() {
    if (!planCode) return;
    setSavingPlan(true);
    setMessage(null);
    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planCode }),
    });
    const payload = await response.json();
    setSavingPlan(false);
    if (!response.ok) return setMessage({ text: payload.error ?? "No se pudo cambiar el plan.", danger: true });
    onUpdate(payload.tenant);
    setMessage({ text: "Plan actualizado." });
  }

  async function handleExtendTrial() {
    setSavingExtend(true);
    setMessage(null);
    const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extendTrialDays: extendDays }),
    });
    const payload = await response.json();
    setSavingExtend(false);
    if (!response.ok) return setMessage({ text: payload.error ?? "No se pudo extender la prueba.", danger: true });
    onUpdate(payload.tenant);
    setMessage({ text: "Prueba extendida." });
  }

  async function handleReinvite() {
    setReinviting(true);
    setMessage(null);
    const result = await postAction(`/api/admin/tenants/${tenant.id}/reinvite`);
    setReinviting(false);
    setMessage(result.ok ? { text: "Invitación reenviada." } : { text: result.error, danger: true });
  }

  async function handleCheckoutLink() {
    setGeneratingCheckout(true);
    setMessage(null);
    setCheckoutUrl(null);
    const result = await postAction(`/api/admin/tenants/${tenant.id}/checkout-link`);
    setGeneratingCheckout(false);
    if (!result.ok) return setMessage({ text: result.error, danger: true });
    setCheckoutUrl(result.data.url as string);
  }

  async function handleImpersonate() {
    setGeneratingSupport(true);
    setMessage(null);
    setSupportUrl(null);
    const result = await postAction(`/api/admin/tenants/${tenant.id}/impersonate`);
    setGeneratingSupport(false);
    if (!result.ok) return setMessage({ text: result.error, danger: true });
    setSupportUrl(result.data.url as string);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-foreground-muted">Estado</p>
          <StatusChanger tenant={tenant} onUpdate={onUpdate} />
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div>
            <p className="mb-1 text-xs font-medium text-foreground-muted">Cambiar plan</p>
            <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="h-8 w-40 text-xs">
              {assignablePlans.map((plan) => (
                <option key={plan.id} value={plan.code}>
                  {plan.name}
                  {plan.public ? "" : " (oculto)"}
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" disabled={savingPlan} onClick={handleChangePlan}>
            {savingPlan ? "..." : "Aplicar"}
          </Button>
        </div>

        {tenant.status === "trialing" ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-xs font-medium text-foreground-muted">Extender prueba (días)</p>
              <Input
                type="number"
                min={1}
                max={90}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                className="h-8 w-24 text-xs"
              />
            </div>
            <Button size="sm" disabled={savingExtend} onClick={handleExtendTrial}>
              {savingExtend ? "..." : "Extender"}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" disabled={reinviting} onClick={handleReinvite}>
            {reinviting ? "..." : "Reenviar invitación"}
          </Button>

          {tenant.billing_mode === "stripe" ? (
            <Button size="sm" variant="secondary" disabled={generatingCheckout} onClick={handleCheckoutLink}>
              {generatingCheckout ? "..." : "Generar link de Checkout"}
            </Button>
          ) : null}

          <Button size="sm" variant="secondary" disabled={generatingSupport} onClick={handleImpersonate}>
            {generatingSupport ? "..." : "Entrar como soporte"}
          </Button>
        </div>

        {checkoutUrl ? (
          <p className="flex items-center gap-2 text-sm text-foreground-muted">
            Link de Checkout: <CopyLinkButton url={checkoutUrl} />
          </p>
        ) : null}
        {supportUrl ? (
          <p className="flex items-center gap-2 text-sm text-foreground-muted">
            Link de acceso (sesión completa, auditado): <CopyLinkButton url={supportUrl} />
          </p>
        ) : null}
        {message ? <p className={`text-sm ${message.danger ? "text-danger" : "text-ok"}`}>{message.text}</p> : null}
      </CardContent>
    </Card>
  );
}

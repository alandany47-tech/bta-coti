import { getPanelContext, hasRole } from "@/lib/auth/panel";
import { PlanPicker } from "@/components/billing/plan-picker";
import { PortalButton } from "@/components/billing/portal-button";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: "Pagada",
  open: "Pendiente",
  uncollectible: "Sin cobrar",
  void: "Anulada",
  draft: "Borrador",
};

const STATUS_LABEL: Record<string, string> = {
  trialing: "En prueba",
  active: "Activo",
  past_due: "Pago pendiente",
  suspended: "Suspendido",
  canceled: "Cancelado",
};

const dateFormat = new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "long", day: "numeric" });

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { tenant: slug } = await params;
  const { checkout } = await searchParams;
  // anyStatus: un tenant suspended/canceled es justo el que necesita esta página para pagar y
  // reactivarse (lib/tenant-page.ts); el layout ya llamó a getPanelContext igual para no duplicar.
  const { supabase, tenant, role } = await getPanelContext(slug, true);
  const isOwner = hasRole(role, "owner");

  if (tenant.is_demo) {
    return (
      <div className="flex flex-1 flex-col gap-2 p-6">
        <h1 className="text-2xl">Facturación</h1>
        <p className="text-sm text-ink-2">La demo no tiene facturación propia.</p>
      </div>
    );
  }

  const [{ data: currentTenant }, { data: plans }, { data: subscription }] = await Promise.all([
    supabase
      .from("tenants")
      .select("plan_id, stripe_customer_id, stripe_subscription_id, status_reason")
      .eq("id", tenant.id)
      .maybeSingle(),
    supabase.from("plans").select("id, code, name, price_month, price_year, sort").eq("public", true).order("sort"),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
  ]);

  const currentPlan = (plans ?? []).find((p) => p.id === currentTenant?.plan_id) ?? null;
  const trialDaysLeft = tenant.status === "trialing" ? daysLeft(tenant.trial_ends_at) : null;

  // Las últimas facturas se piden directo a Stripe (no hay tabla local de facturas): solo lectura,
  // así que no hace falta pasar por una ruta de API ni por la service role de Supabase.
  const invoices =
    isOwner && currentTenant?.stripe_customer_id && stripeConfigured()
      ? await getStripe()
          .invoices.list({ customer: currentTenant.stripe_customer_id, limit: 5 })
          .then((r) => r.data)
          .catch(() => [])
      : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl">Facturación</h1>
        <p className="text-sm text-ink-2">Tu plan, el estado de la cuenta y cómo pagar.</p>
      </div>

      {checkout === "success" ? (
        <p className="rounded-md border border-ok/30 bg-ok/5 p-3 text-sm text-ok">
          Pago en proceso. En cuanto Stripe lo confirme, tu cuenta se actualiza sola (puede tardar
          unos segundos, o unos días si pagaste por SPEI).
        </p>
      ) : null}
      {checkout === "cancel" ? (
        <p className="rounded-md border border-border-subtle bg-surface p-3 text-sm text-foreground-muted">
          Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-2">Estado:</span>
          <span className="font-medium text-ink">{STATUS_LABEL[tenant.status] ?? tenant.status}</span>
          {currentPlan ? <span className="text-sm text-ink-3">· Plan {currentPlan.name}</span> : null}
        </div>
        {tenant.status === "trialing" && trialDaysLeft !== null ? (
          <p className="text-sm text-ink-2">
            Tu prueba termina el {tenant.trial_ends_at ? dateFormat.format(new Date(tenant.trial_ends_at)) : ""}
            {" "}({trialDaysLeft === 0 ? "hoy" : `${trialDaysLeft} día${trialDaysLeft === 1 ? "" : "s"}`}).
          </p>
        ) : null}
        {tenant.status === "past_due" ? (
          <p className="text-sm text-danger">
            Tu último pago no pasó. Tienes 7 días de gracia antes de que se suspenda la cuenta —
            revisa tu método de pago desde el portal de abajo.
          </p>
        ) : null}
        {tenant.status === "suspended" ? (
          <p className="text-sm text-danger">
            Tu cuenta está suspendida{currentTenant?.status_reason === "trial_expired" ? " (la prueba terminó)" : ""}.
            Elige un plan abajo para reactivarla.
          </p>
        ) : null}
        {subscription?.current_period_end ? (
          <p className="text-sm text-ink-2">
            {subscription.cancel_at_period_end ? "Se cancela el" : "Se renueva el"}{" "}
            {dateFormat.format(new Date(subscription.current_period_end))}.
          </p>
        ) : null}
        {currentTenant?.stripe_customer_id ? (
          <div>
            <PortalButton tenantSlug={slug} />
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <PlanPicker
          tenantSlug={slug}
          plans={(plans ?? []).map((p) => ({ code: p.code, name: p.name, priceMonth: Number(p.price_month), priceYear: Number(p.price_year), sort: p.sort }))}
          currentPlanCode={currentPlan?.code ?? null}
          hasSubscription={Boolean(currentTenant?.stripe_subscription_id)}
        />
      ) : (
        <p className="text-sm text-ink-3">Solo el dueño del negocio puede cambiar el plan o el método de pago.</p>
      )}

      {currentPlan ? (
        <p className="text-xs text-ink-3">
          Precio actual: {formatCurrency(currentPlan.price_month)}/mes o {formatCurrency(currentPlan.price_year)}/año.
        </p>
      ) : null}

      {invoices.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">Últimas facturas</h2>
          <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {invoices.map((invoice) => (
              <a
                key={invoice.id}
                href={invoice.hosted_invoice_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-4 p-3 text-sm hover:bg-sunken"
              >
                <span className="text-ink-2">
                  {invoice.created ? dateFormat.format(new Date(invoice.created * 1000)) : ""}
                </span>
                <span className="text-ink-3">{INVOICE_STATUS_LABEL[invoice.status ?? ""] ?? invoice.status}</span>
                <span className="tabular font-medium text-ink">{formatCurrency(invoice.total / 100)}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

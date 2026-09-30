import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export type AdminSubscriptionRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planName: string;
  collectionMethod: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Suscripciones locales + plan/tenant (docs/ADMIN-PANEL.md §2, sección Pagos). */
export async function listSubscriptionsForAdmin(): Promise<AdminSubscriptionRow[]> {
  const { data, error } = await createServiceRoleClient()
    .from("subscriptions")
    .select("tenant_id, stripe_customer_id, status, collection_method, current_period_end, cancel_at_period_end, tenants(name, slug)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`No se pudieron cargar las suscripciones: ${error.message}`);

  type Row = {
    tenant_id: string;
    stripe_customer_id: string;
    status: string;
    collection_method: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    tenants: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  // El plan actual se resuelve aparte (no por el join de arriba: subscriptions no tiene plan_id,
  // y el plan_id que sí trae tenants puede haber cambiado desde que se creó la suscripción).
  const planNames = await planNamesByTenantId(rows.map((r) => r.tenant_id));

  return rows.map((r) => {
    const tenant = one(r.tenants);
    return {
      tenantId: r.tenant_id,
      tenantName: tenant?.name ?? "—",
      tenantSlug: tenant?.slug ?? "—",
      planName: planNames.get(r.tenant_id) ?? "—",
      collectionMethod: r.collection_method,
      status: r.status,
      currentPeriodEnd: r.current_period_end,
      cancelAtPeriodEnd: r.cancel_at_period_end,
      stripeCustomerId: r.stripe_customer_id,
    };
  });
}

async function planNamesByTenantId(tenantIds: string[]): Promise<Map<string, string>> {
  if (tenantIds.length === 0) return new Map();
  const { data } = await createServiceRoleClient()
    .from("tenants")
    .select("id, plans(name)")
    .in("id", tenantIds);
  const rows = (data ?? []) as unknown as { id: string; plans: { name: string } | { name: string }[] | null }[];
  return new Map(rows.map((r) => [r.id, one(r.plans)?.name ?? "—"]));
}

export type PendingInvoiceRow = {
  tenantName: string;
  tenantSlug: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  hostedInvoiceUrl: string | null;
  overdue: boolean;
};

/**
 * Facturas SPEI (`collection_method: "send_invoice"`) todavía abiertas — tarjeta no genera
 * facturas `open` de esta forma (docs/STRIPE.md §3). Una sola llamada a Stripe (no una por
 * tenant), cruzada contra `subscriptions` local por `customer` id.
 */
export async function listPendingInvoices(): Promise<PendingInvoiceRow[]> {
  if (!stripeConfigured()) return [];

  const subs = await listSubscriptionsForAdmin();
  const byCustomer = new Map(subs.map((s) => [s.stripeCustomerId, s]));

  const invoices = await getStripe().invoices.list({ status: "open", limit: 100 });
  const now = Date.now();

  return invoices.data
    .filter((invoice) => invoice.collection_method === "send_invoice")
    .map((invoice) => {
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      const sub = customerId ? byCustomer.get(customerId) : undefined;
      const dueDate = invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null;
      return {
        tenantName: sub?.tenantName ?? "—",
        tenantSlug: sub?.tenantSlug ?? "—",
        amount: invoice.amount_due / 100,
        currency: invoice.currency,
        dueDate,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        overdue: dueDate ? new Date(dueDate).getTime() < now : false,
      };
    });
}

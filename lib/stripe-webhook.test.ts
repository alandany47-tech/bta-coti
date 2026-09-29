import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

type StatusResult = { ok: true; slug: string } | { ok: false; code: "reason_required" | "not_found" | "error" };

const { setTenantStatus, logAudit } = vi.hoisted(() => ({
  setTenantStatus: vi.fn(async (): Promise<StatusResult> => ({ ok: true, slug: "tenant-x" })),
  logAudit: vi.fn(async () => {}),
}));
vi.mock("@/lib/admin-status", () => ({ setTenantStatus, logAudit }));

const { handleStripeEvent } = await import("./stripe-webhook");

type Row = Record<string, unknown>;

function fakeSupabase(initial: { stripe_events?: Row[]; subscriptions?: Row[]; plans?: Row[]; tenants?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    stripe_events: initial.stripe_events ?? [],
    subscriptions: initial.subscriptions ?? [],
    plans: initial.plans ?? [],
    tenants: initial.tenants ?? [],
  };
  const client = {
    tables,
    from(name: string) {
      const rows = tables[name];
      return {
        insert: async (row: Row) => {
          if (name === "stripe_events" && rows.some((r) => r.id === row.id)) {
            return { error: { code: "23505" } };
          }
          rows.push(row);
          return { error: null };
        },
        update: (patch: Row) => ({
          eq: async (col: string, value: unknown) => {
            for (const row of rows) if (row[col] === value) Object.assign(row, patch);
            return { error: null };
          },
        }),
        upsert: async (row: Row) => {
          const idx = rows.findIndex((r) => r.tenant_id === row.tenant_id);
          if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
          else rows.push(row);
          return { error: null };
        },
        select: () => ({
          eq: (col: string, value: unknown) => ({
            maybeSingle: async () => ({ data: rows.find((r) => r[col] === value) ?? null, error: null }),
          }),
          or: () => ({
            maybeSingle: async () => {
              // usado solo por planIdForPrice; basta con la primera coincidencia por price id
              const match = rows.find((r) => r.stripe_price_month || r.stripe_price_year);
              return { data: match ?? null, error: null };
            },
          }),
        }),
      };
    },
  };
  return client as never;
}

function fakeEvent(id: string, type: string, object: unknown): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

beforeEach(() => {
  setTenantStatus.mockClear();
  logAudit.mockClear();
});

describe("handleStripeEvent", () => {
  it("no reprocesa un evento cuya id ya está en stripe_events", async () => {
    const supabase = fakeSupabase({ stripe_events: [{ id: "evt_1", type: "invoice.paid" }] });
    await handleStripeEvent(fakeEvent("evt_1", "invoice.paid", {}), supabase);
    expect(setTenantStatus).not.toHaveBeenCalled();
  });

  it("checkout.session.completed activa el tenant solo si ya se pagó", async () => {
    const supabase = fakeSupabase({ tenants: [{ id: "tenant-1" }] });
    const session = { client_reference_id: "tenant-1", payment_status: "paid", metadata: {} };
    await handleStripeEvent(fakeEvent("evt_2", "checkout.session.completed", session), supabase);
    expect(setTenantStatus).toHaveBeenCalledWith("tenant-1", "active", null, null);
  });

  it("checkout.session.completed NO activa si el pago sigue pendiente (OXXO/SPEI vía voucher)", async () => {
    const supabase = fakeSupabase({ tenants: [{ id: "tenant-1" }] });
    const session = { client_reference_id: "tenant-1", payment_status: "unpaid", metadata: {} };
    await handleStripeEvent(fakeEvent("evt_2b", "checkout.session.completed", session), supabase);
    expect(setTenantStatus).not.toHaveBeenCalled();
  });

  it("customer.subscription.updated guarda la fila y liga customer/plan al tenant (Checkout o SPEI directo)", async () => {
    const supabase = fakeSupabase({
      plans: [{ id: "plan-esencial", stripe_price_month: "price_esencial_month", stripe_price_year: "price_esencial_year" }],
      tenants: [{ id: "tenant-1" }],
    });
    const sub = {
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      collection_method: "charge_automatically",
      cancel_at_period_end: false,
      metadata: { tenant_id: "tenant-1" },
      items: { data: [{ price: { id: "price_esencial_month" }, current_period_end: 1893456000 }] },
    };
    await handleStripeEvent(fakeEvent("evt_3", "customer.subscription.updated", sub), supabase);

    const tables = (supabase as never as { tables: { subscriptions: Row[]; tenants: Row[] } }).tables;
    expect(tables.subscriptions[0]).toMatchObject({ tenant_id: "tenant-1", stripe_subscription_id: "sub_1", status: "active" });
    expect(tables.tenants[0]).toMatchObject({ plan_id: "plan-esencial", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" });
  });

  it("customer.subscription.deleted cancela la suscripción y el tenant", async () => {
    const supabase = fakeSupabase({ subscriptions: [{ tenant_id: "tenant-1", stripe_subscription_id: "sub_1", status: "active" }] });
    const sub = { id: "sub_1", metadata: { tenant_id: "tenant-1" } };
    await handleStripeEvent(fakeEvent("evt_4", "customer.subscription.deleted", sub), supabase);

    expect((supabase as never as { tables: { subscriptions: Row[] } }).tables.subscriptions[0]).toMatchObject({ status: "canceled" });
    expect(setTenantStatus).toHaveBeenCalledWith("tenant-1", "canceled", "subscription_deleted", null);
  });

  it("invoice.payment_failed pone el tenant en past_due buscando por la suscripción", async () => {
    const supabase = fakeSupabase({ subscriptions: [{ tenant_id: "tenant-1", stripe_subscription_id: "sub_1" }] });
    const invoice = { parent: { subscription_details: { subscription: "sub_1" } } };
    await handleStripeEvent(fakeEvent("evt_5", "invoice.payment_failed", invoice), supabase);

    expect(setTenantStatus).toHaveBeenCalledWith("tenant-1", "past_due", "payment_failed", null);
  });

  it("invoice.paid sin suscripción asociada no llama a setTenantStatus", async () => {
    const supabase = fakeSupabase();
    const invoice = { parent: null };
    await handleStripeEvent(fakeEvent("evt_6", "invoice.paid", invoice), supabase);
    expect(setTenantStatus).not.toHaveBeenCalled();
  });

  it("charge.dispute.created deja auditoría sin tenant_id (no viaja en el objeto)", async () => {
    const supabase = fakeSupabase();
    const dispute = { id: "dp_1", amount: 50000, charge: "ch_1" };
    await handleStripeEvent(fakeEvent("evt_7", "charge.dispute.created", dispute), supabase);
    expect(logAudit).toHaveBeenCalledWith("stripe.dispute_created", null, null, { dispute_id: "dp_1", amount: 50000, charge: "ch_1" });
  });

  it("solo marca el evento como procesado DESPUÉS de aplicar sus efectos, y no antes", async () => {
    const supabase = fakeSupabase({ tenants: [{ id: "tenant-1" }] });
    const session = { client_reference_id: "tenant-1", payment_status: "paid", metadata: {} };
    const tables = (supabase as never as { tables: { stripe_events: Row[] } }).tables;

    await handleStripeEvent(fakeEvent("evt_8", "checkout.session.completed", session), supabase);
    expect(tables.stripe_events).toHaveLength(1);
    expect(setTenantStatus).toHaveBeenCalledTimes(1);

    // un reintento de Stripe con el mismo evento ya no vuelve a procesar
    await handleStripeEvent(fakeEvent("evt_8", "checkout.session.completed", session), supabase);
    expect(setTenantStatus).toHaveBeenCalledTimes(1);
  });

  it("si setTenantStatus falla, revienta y NO marca el evento como procesado (para que Stripe reintente)", async () => {
    setTenantStatus.mockResolvedValueOnce({ ok: false, code: "error" });
    const supabase = fakeSupabase({ tenants: [{ id: "tenant-1" }] });
    const session = { client_reference_id: "tenant-1", payment_status: "paid", metadata: {} };

    await expect(handleStripeEvent(fakeEvent("evt_9", "checkout.session.completed", session), supabase)).rejects.toThrow();
    expect((supabase as never as { tables: { stripe_events: Row[] } }).tables.stripe_events).toHaveLength(0);
  });
});

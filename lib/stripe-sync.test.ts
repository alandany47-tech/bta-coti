import { describe, expect, it, vi } from "vitest";
import { syncPlansToStripe } from "./stripe-sync";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  price_month: number;
  price_year: number;
  stripe_price_month: string | null;
  stripe_price_year: string | null;
};

function fakeSupabase(plans: PlanRow[]) {
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  return {
    updates,
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            returns: async () => ({ data: plans, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, patch });
            const plan = plans.find((p) => p.id === id);
            if (plan) Object.assign(plan, patch);
            return { error: null };
          },
        }),
      }),
    },
  };
}

function fakeStripe(opts: { existingProduct?: { id: string; metadata: { plan_code: string }; name: string }; existingPrices?: Record<string, { id: string; unit_amount: number }> } = {}) {
  const products = { ...opts };
  const priceStore = { ...(opts.existingPrices ?? {}) };
  const createdProducts: unknown[] = [];
  const createdPrices: unknown[] = [];
  return {
    createdProducts,
    createdPrices,
    priceStore,
    client: {
      products: {
        list: vi.fn(async () => ({ data: products.existingProduct ? [products.existingProduct] : [] })),
        update: vi.fn(async () => ({})),
        create: vi.fn(async (args: { name: string; metadata: { plan_code: string } }) => {
          const created = { id: `prod_${args.metadata.plan_code}`, ...args };
          createdProducts.push(created);
          return created;
        }),
      },
      prices: {
        list: vi.fn(async (args: { lookup_keys: string[] }) => {
          const key = args.lookup_keys[0];
          const found = priceStore[key];
          return { data: found ? [found] : [] };
        }),
        create: vi.fn(async (args: { lookup_key: string; unit_amount: number }) => {
          const created = { id: `price_${args.lookup_key}`, unit_amount: args.unit_amount };
          createdPrices.push(created);
          priceStore[args.lookup_key] = created;
          return created;
        }),
      },
    },
  };
}

describe("syncPlansToStripe", () => {
  it("crea producto y precios cuando el plan no tiene nada en Stripe todavía", async () => {
    const plan: PlanRow = {
      id: "p1",
      code: "esencial",
      name: "Esencial",
      price_month: 199,
      price_year: 1990,
      stripe_price_month: null,
      stripe_price_year: null,
    };
    const supabase = fakeSupabase([plan]);
    const stripe = fakeStripe();

    const updated = await syncPlansToStripe(stripe.client as never, supabase.client as never);

    expect(updated).toBe(2);
    expect(stripe.createdProducts).toHaveLength(1);
    expect(stripe.createdPrices).toHaveLength(2);
    expect(plan.stripe_price_month).toBe("price_esencial_month");
    expect(plan.stripe_price_year).toBe("price_esencial_year");
  });

  it("no crea nada si el producto y los precios ya están al día", async () => {
    const plan: PlanRow = {
      id: "p1",
      code: "esencial",
      name: "Esencial",
      price_month: 199,
      price_year: 1990,
      stripe_price_month: "price_existing_month",
      stripe_price_year: "price_existing_year",
    };
    const supabase = fakeSupabase([plan]);
    const stripe = fakeStripe({
      existingProduct: { id: "prod_esencial", metadata: { plan_code: "esencial" }, name: "Esencial" },
      existingPrices: {
        esencial_month: { id: "price_existing_month", unit_amount: 19900 },
        esencial_year: { id: "price_existing_year", unit_amount: 199000 },
      },
    });

    const updated = await syncPlansToStripe(stripe.client as never, supabase.client as never);

    expect(updated).toBe(0);
    expect(stripe.createdProducts).toHaveLength(0);
    expect(stripe.createdPrices).toHaveLength(0);
  });

  it("crea un precio nuevo (y lo guarda) cuando el monto cambió", async () => {
    const plan: PlanRow = {
      id: "p1",
      code: "esencial",
      name: "Esencial",
      price_month: 249, // subió de 199 a 249
      price_year: 1990,
      stripe_price_month: "price_existing_month",
      stripe_price_year: "price_existing_year",
    };
    const supabase = fakeSupabase([plan]);
    const stripe = fakeStripe({
      existingProduct: { id: "prod_esencial", metadata: { plan_code: "esencial" }, name: "Esencial" },
      existingPrices: {
        esencial_month: { id: "price_existing_month", unit_amount: 19900 },
        esencial_year: { id: "price_existing_year", unit_amount: 199000 },
      },
    });

    const updated = await syncPlansToStripe(stripe.client as never, supabase.client as never);

    expect(updated).toBe(1);
    expect(stripe.createdPrices).toHaveLength(1);
    expect(plan.stripe_price_month).toBe("price_esencial_month");
    expect(plan.stripe_price_year).toBe("price_existing_year");
  });
});

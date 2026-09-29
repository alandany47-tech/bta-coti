import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  price_month: number;
  price_year: number;
  stripe_price_month: string | null;
  stripe_price_year: string | null;
};

type Interval = "month" | "year";

async function findOrCreateProduct(stripe: Stripe, plan: PlanRow): Promise<string> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((p) => p.metadata.plan_code === plan.code);
  if (existing) {
    if (existing.name !== plan.name) await stripe.products.update(existing.id, { name: plan.name });
    return existing.id;
  }
  const created = await stripe.products.create({ name: plan.name, metadata: { plan_code: plan.code } });
  return created.id;
}

async function findOrCreatePrice(
  stripe: Stripe,
  productId: string,
  lookupKey: string,
  amountMxn: number,
  interval: Interval,
): Promise<string> {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const current = existing.data[0];
  // Un Price es inmutable en monto/intervalo: si cambió el precio, se crea uno nuevo y se
  // reasigna el lookup_key (Stripe permite un solo Price activo por lookup_key a la vez).
  if (current && current.unit_amount === Math.round(amountMxn * 100)) return current.id;

  const created = await stripe.prices.create({
    product: productId,
    currency: "mxn",
    unit_amount: Math.round(amountMxn * 100),
    recurring: { interval },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
  });
  return created.id;
}

/**
 * Crea o actualiza en Stripe un Product por plan público y dos Prices (mensual/anual) con
 * `lookup_key` `<plan>_month` / `<plan>_year` (docs/STRIPE.md §1), y guarda los Price IDs en
 * `plans`. Reentrante: si ya existen y no cambió el precio, no hace nada.
 */
export async function syncPlansToStripe(stripe: Stripe, supabase: SupabaseClient): Promise<number> {
  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, code, name, price_month, price_year, stripe_price_month, stripe_price_year")
    .eq("public", true)
    .returns<PlanRow[]>();
  if (error) throw error;

  let updated = 0;
  for (const plan of plans ?? []) {
    const productId = await findOrCreateProduct(stripe, plan);
    for (const interval of ["month", "year"] as const) {
      const lookupKey = `${plan.code}_${interval}`;
      const amount = interval === "month" ? plan.price_month : plan.price_year;
      const priceId = await findOrCreatePrice(stripe, productId, lookupKey, amount, interval);
      const column = interval === "month" ? "stripe_price_month" : "stripe_price_year";
      if (plan[column] !== priceId) {
        const { error: updateError } = await supabase.from("plans").update({ [column]: priceId }).eq("id", plan.id);
        if (updateError) throw updateError;
        updated += 1;
      }
    }
  }
  return updated;
}

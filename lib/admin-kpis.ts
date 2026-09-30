import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

type MrrSubscription = { status: string; stripe_price_id: string | null };
type MrrPlan = {
  price_month: number;
  price_year: number;
  stripe_price_month: string | null;
  stripe_price_year: string | null;
};

/** MRR = mensuales tal cual + anuales entre 12, solo suscripciones `active`. Puro y testeable. */
export function computeMrr(subscriptions: MrrSubscription[], plans: MrrPlan[]): number {
  return subscriptions.reduce((sum, sub) => {
    if (sub.status !== "active" || !sub.stripe_price_id) return sum;
    const plan = plans.find(
      (p) => p.stripe_price_month === sub.stripe_price_id || p.stripe_price_year === sub.stripe_price_id,
    );
    if (!plan) return sum;
    const monthly = plan.stripe_price_month === sub.stripe_price_id ? plan.price_month : plan.price_year / 12;
    return sum + monthly;
  }, 0);
}

/**
 * Conversión de prueba a pago (30 días): de los tenants cuya prueba VENCIÓ en los últimos 30 días
 * (`trial_ends_at` en esa ventana), cuántos están hoy `active`. Es una definición razonable entre
 * varias posibles — no la única — documentada aquí para no repreguntarla cada vez.
 */
export function computeTrialConversion(
  tenantsWithTrialEndingSoon: { status: string }[],
): { converted: number; total: number } | null {
  if (tenantsWithTrialEndingSoon.length === 0) return null;
  return {
    converted: tenantsWithTrialEndingSoon.filter((t) => t.status === "active").length,
    total: tenantsWithTrialEndingSoon.length,
  };
}

export type AdminKpis = {
  mrr: number;
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  trialConversion30d: { converted: number; total: number } | null;
  storageBytesTotal: number;
  trialsEndingSoon: { id: string; name: string; slug: string; trial_ends_at: string }[];
  recentPastDue: { id: string; name: string; slug: string; status_changed_at: string | null }[];
};

/** KPIs del Resumen del Panel Admin (T24). Service role: llamar solo tras validar getAdminUser(). */
export async function getAdminKpis(): Promise<AdminKpis> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const ago30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: activeCount },
    { count: trialingCount },
    { count: pastDueCount },
    { data: subs },
    { data: plans },
    { data: usageRows },
    { data: trialWindowRows },
    { data: trialsEndingSoon },
    { data: recentPastDue },
  ] = await Promise.all([
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "active"),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "trialing"),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "past_due"),
    supabase.from("subscriptions").select("status, stripe_price_id").eq("status", "active"),
    supabase.from("plans").select("price_month, price_year, stripe_price_month, stripe_price_year"),
    supabase.from("usage").select("storage_bytes, tenants(is_demo)"),
    supabase
      .from("tenants")
      .select("id, status")
      .eq("is_demo", false)
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", ago30Days)
      .lte("trial_ends_at", now.toISOString()),
    supabase
      .from("tenants")
      .select("id, name, slug, trial_ends_at")
      .eq("is_demo", false)
      .eq("status", "trialing")
      .lte("trial_ends_at", in2Days)
      .order("trial_ends_at", { ascending: true }),
    supabase
      .from("tenants")
      .select("id, name, slug, status_changed_at")
      .eq("is_demo", false)
      .eq("status", "past_due")
      .order("status_changed_at", { ascending: false })
      .limit(10),
  ]);

  const mrr = computeMrr(
    (subs ?? []) as MrrSubscription[],
    ((plans ?? []) as { price_month: string | number; price_year: string | number; stripe_price_month: string | null; stripe_price_year: string | null }[]).map(
      (p) => ({ ...p, price_month: Number(p.price_month), price_year: Number(p.price_year) }),
    ),
  );

  const storageBytesTotal = (
    (usageRows ?? []) as { storage_bytes: number; tenants: { is_demo: boolean } | { is_demo: boolean }[] | null }[]
  ).reduce((sum, row) => {
    const tenant = Array.isArray(row.tenants) ? (row.tenants[0] ?? null) : row.tenants;
    if (tenant?.is_demo) return sum;
    return sum + (row.storage_bytes ?? 0);
  }, 0);

  return {
    mrr,
    activeCount: activeCount ?? 0,
    trialingCount: trialingCount ?? 0,
    pastDueCount: pastDueCount ?? 0,
    trialConversion30d: computeTrialConversion((trialWindowRows ?? []) as { status: string }[]),
    storageBytesTotal,
    trialsEndingSoon: (trialsEndingSoon ?? []) as AdminKpis["trialsEndingSoon"],
    recentPastDue: (recentPastDue ?? []) as AdminKpis["recentPastDue"],
  };
}

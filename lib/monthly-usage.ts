import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Resetea usage.quotes_this_month al cambiar de mes (T17). Idempotente: solo toca filas de un mes viejo. */
export async function resetMonthlyQuoteCounters(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("reset_monthly_quote_counters");
  if (error) throw error;
  return data ?? 0;
}

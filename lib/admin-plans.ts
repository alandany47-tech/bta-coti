import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/plans-shared";

export { PLAN_MODULES, LIMIT_FIELDS, validatePlanInput } from "@/lib/plans-shared";
export type { Plan, PlanModule, LimitField, PlanLimits, PlanInput, ValidatedPlan } from "@/lib/plans-shared";

/** Todos los planes (tabla chica, sin paginar), incluidos los ocultos (`public = false`). */
export async function listPlansForAdmin(): Promise<Plan[]> {
  const { data, error } = await createServiceRoleClient().from("plans").select("*").order("sort", { ascending: true });
  if (error) throw new Error(`No se pudieron cargar los planes: ${error.message}`);
  return (data ?? []) as unknown as Plan[];
}

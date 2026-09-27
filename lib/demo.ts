import "server-only";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tenantTag } from "@/lib/tenants";

/** Slugs de los tenants de demo (docs/DEMO.md §4.1), sembrados por `reset_demo_data()` (0020). */
export const DEMO_TENANT_SLUGS = [
  "demo-esencial",
  "demo-catalogo",
  "demo-broker",
  "demo-brokerpro",
  "demo-prueba",
  "demo-morosa",
  "demo-suspendida",
  "demo-cancelada",
] as const;

export const DEMO_SHOWCASE_TENANT_SLUG = "demo-broker";

/**
 * Reset nocturno de la demo (docs/DEMO.md §3): vuelve a correr `reset_demo_data`, que borra los 8
 * tenants `demo-*` y los recrea desde cero (mismos datos, misma contraseña). Los ids cambian, así
 * que hay que invalidar el caché de cada slug para que el próximo request los vea.
 */
export async function resetDemoData(): Promise<{ ok: true } | { ok: false; error: string }> {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return { ok: false, error: "Falta configurar DEMO_PASSWORD." };

  const { error } = await createServiceRoleClient().rpc("reset_demo_data", { p_password: password });
  if (error) return { ok: false, error: error.message };

  for (const slug of DEMO_TENANT_SLUGS) revalidateTag(tenantTag(slug), { expire: 0 });
  return { ok: true };
}

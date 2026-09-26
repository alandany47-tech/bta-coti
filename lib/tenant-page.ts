import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { rootOrigin } from "@/lib/auth/redirects";
import { getTenantAnyStatus, getTenantBySlug } from "@/lib/tenants";
import type { PublicTenant } from "@/lib/types";

/**
 * Tenant operable para layouts y páginas. Cada segmento lo llama por su cuenta (un layout no
 * detiene el render de sus hijos): un tenant suspendido redirige a la pantalla de bloqueo y
 * uno inexistente o cancelado cae en 404.
 */
export async function requireOperableTenant(slug: string): Promise<PublicTenant> {
  const tenant = await getTenantBySlug(slug);
  if (tenant) return tenant;
  const any = await getTenantAnyStatus(slug);
  if (any?.status === "suspended") {
    const host = (await headers()).get("host") ?? "";
    redirect(`${rootOrigin(host)}/suspended?tenant=${encodeURIComponent(slug)}`);
  }
  notFound();
}

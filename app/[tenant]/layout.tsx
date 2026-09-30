import { headers } from "next/headers";
import { requireOperableTenant } from "@/lib/tenant-page";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  // /panel/facturacion es la única página que un tenant suspended/canceled puede alcanzar (para
  // pagar y reactivarse); sin esto, este layout ancestro lo bloquea antes de que el layout del
  // panel llegue a aplicar su propia excepción (hallazgo de Codex sobre T21).
  const isBilling = ((await headers()).get("x-tenant-pathname") ?? "").startsWith("/panel/facturacion");
  await requireOperableTenant(slug, { anyStatus: isBilling });

  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}

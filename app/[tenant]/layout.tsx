import { notFound } from "next/navigation";
import { SuspendedView } from "@/components/suspended-view";
import { getTenantAnyStatus, getTenantBySlug } from "@/lib/tenants";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    // Kill-switch: un tenant suspendido muestra el bloqueo en cualquier ruta de su subdominio.
    const any = await getTenantAnyStatus(slug);
    if (any?.status === "suspended") return <SuspendedView tenantName={any.name} />;
    notFound();
  }

  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}

import { SuspendedView } from "@/components/suspended-view";
import { getTenantAnyStatus } from "@/lib/tenants";

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: slug } = await searchParams;
  const tenant = slug ? await getTenantAnyStatus(slug) : null;
  return <SuspendedView tenantName={tenant?.name ?? null} />;
}

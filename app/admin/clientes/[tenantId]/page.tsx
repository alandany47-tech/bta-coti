import { notFound } from "next/navigation";
import { getTenantForAdmin, getTenantMembers } from "@/lib/admin-tenants";
import { listPlansForAdmin } from "@/lib/admin-plans";
import { listAuditLogForAdmin } from "@/lib/admin-audit";
import { stripeDashboardUrl } from "@/lib/stripe";
import { ClienteDetalle } from "@/components/admin/cliente-detalle";
import { BRAND } from "@/lib/brand";

export default async function AdminClienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const tenant = await getTenantForAdmin(tenantId);
  if (!tenant) notFound();

  const [members, plans, history] = await Promise.all([
    getTenantMembers(tenantId),
    listPlansForAdmin(),
    listAuditLogForAdmin({ tenantId, page }),
  ]);

  return (
    <ClienteDetalle
      tenant={tenant}
      members={members}
      plans={plans}
      history={history}
      rootDomain={BRAND.domain}
      stripeCustomerUrl={tenant.stripe_customer_id ? stripeDashboardUrl("customers", tenant.stripe_customer_id) : null}
      stripeSubscriptionUrl={tenant.stripe_subscription_id ? stripeDashboardUrl("subscriptions", tenant.stripe_subscription_id) : null}
    />
  );
}

import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenants";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}

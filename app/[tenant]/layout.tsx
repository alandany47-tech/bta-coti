import { requireOperableTenant } from "@/lib/tenant-page";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  await requireOperableTenant(slug);

  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}

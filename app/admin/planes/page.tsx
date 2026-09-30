import { listPlansForAdmin } from "@/lib/admin-plans";
import { PlanesConsole } from "@/components/admin/planes-console";

export default async function AdminPlanesPage() {
  const plans = await listPlansForAdmin();
  return <PlanesConsole initialPlans={plans} />;
}

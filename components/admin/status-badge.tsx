import { cn } from "@/lib/utils";
import type { TenantStatus } from "@/lib/types";

const STATUS_LABEL: Record<TenantStatus, string> = {
  trialing: "En prueba",
  active: "Activo",
  past_due: "Pago vencido",
  suspended: "Suspendido",
  canceled: "Cancelado",
};

const STATUS_CLASSNAME: Record<TenantStatus, string> = {
  trialing: "bg-blue-950 text-blue-300",
  active: "bg-emerald-950 text-emerald-300",
  past_due: "bg-amber-950 text-amber-300",
  suspended: "bg-red-950 text-red-300",
  canceled: "bg-surface-hover text-muted",
};

export function StatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSNAME[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export { STATUS_LABEL };

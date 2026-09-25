import { cn } from "@/lib/utils";
import type { TenantStatus } from "@/lib/types";

const STATUS_LABEL: Record<TenantStatus, string> = {
  trialing: "En prueba",
  active: "Activo",
  past_due: "Pago vencido",
  suspended: "Suspendido",
  canceled: "Cancelado",
};

const STATUS_DOT: Record<TenantStatus, string> = {
  trialing: "bg-accent",
  active: "bg-ok",
  past_due: "bg-warn",
  suspended: "bg-danger",
  canceled: "bg-ink-3",
};

export function StatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export { STATUS_LABEL };

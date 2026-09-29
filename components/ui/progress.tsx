import { cn } from "@/lib/utils";

export function Progress({
  value,
  max,
  className,
}: {
  value: number;
  max: number | null;
  className?: string;
}) {
  const pct = max && max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-200",
          pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-accent",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

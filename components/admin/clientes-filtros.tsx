"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { STATUS_LABEL } from "@/components/admin/status-badge";
import type { TenantStatus } from "@/lib/types";

const ORIGIN_LABEL: Record<string, string> = { self_signup: "Registro", admin: "Admin", demo_clone: "Demo" };

type Filters = { q: string; status: string; plan: string; origin: string };

export function ClientesFiltros({
  basePath,
  initial,
  planOptions,
}: {
  basePath: string;
  initial: Filters;
  planOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const isFirstRender = useRef(true);

  // Búsqueda con debounce; los selects abajo navegan de inmediato al cambiar.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => updateParams({ q }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function updateParams(patch: Partial<Filters>) {
    const next = { ...initial, q, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    if (next.plan) params.set("plan", next.plan);
    if (next.origin) params.set("origin", next.origin);
    // Cambiar cualquier filtro reinicia a la página 1 (no se conserva `page` a propósito).
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Buscar por nombre o subdominio…"
        className="w-64"
      />
      <Select
        value={initial.status}
        onChange={(event) => updateParams({ status: event.target.value })}
        className="w-40"
      >
        <option value="">Todos los estados</option>
        {(Object.keys(STATUS_LABEL) as TenantStatus[]).map((status) => (
          <option key={status} value={status}>
            {STATUS_LABEL[status]}
          </option>
        ))}
      </Select>
      <Select value={initial.plan} onChange={(event) => updateParams({ plan: event.target.value })} className="w-40">
        <option value="">Todos los planes</option>
        {planOptions.map((plan) => (
          <option key={plan.code} value={plan.code}>
            {plan.name}
          </option>
        ))}
      </Select>
      <Select
        value={initial.origin}
        onChange={(event) => updateParams({ origin: event.target.value })}
        className="w-36"
      >
        <option value="">Todo origen</option>
        {Object.entries(ORIGIN_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );
}

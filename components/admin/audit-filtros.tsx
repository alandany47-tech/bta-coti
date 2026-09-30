"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

/** Búsqueda debounced por acción o negocio/subdominio (mismo patrón que ClientesFiltros). */
export function AuditFiltros({ basePath, initialQ }: { basePath: string; initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      router.push(params.size > 0 ? `${basePath}?${params}` : basePath);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Input
      value={q}
      onChange={(event) => setQ(event.target.value)}
      placeholder="Buscar por acción, negocio o subdominio..."
      className="max-w-sm"
    />
  );
}

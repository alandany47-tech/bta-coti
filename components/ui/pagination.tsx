"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * `basePath`/`query` en vez de `useSearchParams`: así no hace falta envolver esto en `<Suspense>`
 * (el Server Component padre ya tiene los searchParams actuales y se los pasa tal cual).
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goTo(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(nextPage));
    router.push(`${basePath}?${params.toString()}`);
  }

  if (totalPages <= 1) {
    return <p className="text-sm text-muted">{total} clientes</p>;
  }

  return (
    <div className="flex items-center justify-between text-sm text-muted">
      <span>
        Página {page} de {totalPages} · {total} clientes
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          Anterior
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}

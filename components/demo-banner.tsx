"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function Banner() {
  const searchParams = useSearchParams();
  // Modo presentación (docs/DEMO.md §4): ?present=1 oculta el banner para enseñar en pantalla completa.
  if (searchParams.get("present")) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-accent-soft px-4 py-2 text-center text-xs text-ink-2">
      <span>Estás en la demo. Los cambios se borran cada noche.</span>
      <Link href="/registro" className="font-semibold text-accent hover:underline">
        Crear mi cuenta gratis
      </Link>
    </div>
  );
}

export function DemoBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}

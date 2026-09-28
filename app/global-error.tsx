"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";

/** Next.js solo usa esta pantalla para errores que revientan el layout raíz (no los de una ruta normal, ver app/[tenant]/error.tsx). */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
        <p className="text-sm text-foreground-muted">
          Ya nos enteramos. Intenta de nuevo en un momento o vuelve a {BRAND.name}.
        </p>
      </body>
    </html>
  );
}

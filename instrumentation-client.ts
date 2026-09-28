import * as Sentry from "@sentry/nextjs";

/**
 * Cliente (navegador). `NEXT_PUBLIC_SENTRY_DSN` sí lleva el prefijo porque este archivo se
 * empaqueta para el navegador. Sin DSN el SDK no manda nada (dev/preview sin cuenta configurada).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

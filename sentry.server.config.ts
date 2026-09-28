import * as Sentry from "@sentry/nextjs";

/**
 * Sin `SENTRY_DSN` el SDK no manda nada (dev/preview sin cuenta configurada). El DSN es público
 * por diseño (identifica el proyecto, no autentica); igual va sin `NEXT_PUBLIC_` porque este
 * archivo solo corre en el servidor.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Sin PII: el SDK no manda IP ni cookies por default, así que no hay nada que apagar aquí.
});

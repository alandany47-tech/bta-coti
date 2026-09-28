import * as Sentry from "@sentry/nextjs";

/** Corre en proxy.ts y en rutas con `runtime = "edge"`. Ver sentry.server.config.ts sobre el DSN. */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});

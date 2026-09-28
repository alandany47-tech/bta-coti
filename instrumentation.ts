import * as Sentry from "@sentry/nextjs";

/** Next.js llama a `register()` una vez por runtime al arrancar (server/edge; el cliente usa instrumentation-client.ts). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

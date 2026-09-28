import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * Sin SENTRY_AUTH_TOKEN (dev, o hasta que exista el proyecto en Sentry) el wrapper solo se salta
 * la subida de source maps con un aviso; el build sigue normal.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});

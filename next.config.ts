import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Encabezados de seguridad (T34, docs/LAUNCH-CHECKLIST.md §4). La CSP es deliberadamente parcial:
 * una `script-src`/`img-src` estricta tiene que contar R2, Sentry, Stripe y Turnstile y se afina con
 * tráfico real (empezar en Report-Only). Aquí solo van las directivas que no pueden romper nada:
 * nadie nos embebe (`frame-ancestors`), ni plugins (`object-src`), ni `<base>` ajena (`base-uri`).
 * Sin `form-action`: Chrome lo aplica también a las redirecciones y rompería el login hacia subdominios.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Sin el badge "N" de Next en dev: aparecía dentro de las capturas de marketing (public/marketing)
  // y estorba al enseñar la app en pantalla.
  devIndicators: false,
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

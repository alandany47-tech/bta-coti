export const BRAND = {
  name: "BTA Cotiza",
  domain: (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "btacotiza.com").toLowerCase(),
  tagline: "Cotizaciones que cierran ventas, listas en un minuto.",
} as const;

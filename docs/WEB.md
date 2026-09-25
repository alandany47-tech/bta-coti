# Sitio web (marketing, registro, pago)

> Misma app de Next.js, rutas del dominio raíz. Diseño según `BRAND.md`. SEO en español de México.

## 1. Mapa

| Ruta | Contenido |
|---|---|
| `/` | Home |
| `/precios` | Tabla de planes (desde la tabla `plans` con `public = true`), toggle mensual/anual y FAQ de facturación |
| `/brokers` | Landing del módulo Broker |
| `/servicios` | Landing del módulo Servicios |
| `/catalogo` | Landing del módulo Catálogo |
| `/registro` | Formulario de autoregistro (ver `AUTH-ONBOARDING.md`) |
| `/login`, `/recuperar`, `/auth/callback` | Auth |
| `/legal/terminos`, `/legal/privacidad` | Obligatorios antes de cobrar (aviso de privacidad LFPDPPP) |
| `/ayuda` | FAQ simple (MDX) |

## 2. Home (estructura)

1. **Hero:** titular en Newsreader ("Cotizaciones que cierran ventas.") + subtítulo con número concreto + CTA "Prueba 7 días gratis" + captura real de una cotización en móvil y escritorio. Sin ilustraciones.
2. **Tres módulos:** tres columnas con **captura** de cada uno (no íconos) y "desde $X/mes".
3. **Cómo funciona:** 3 pasos con capturas: sube tu catálogo → arma la cotización → mándala por WhatsApp.
4. **Demo en vivo:** link a `demo.dominio.com` (tenant de muestra con datos reales de ejemplo).
5. **Precios resumidos** y link a `/precios`.
6. **FAQ** de 6 preguntas.
7. **CTA final.**
8. **Footer:** legal, contacto por WhatsApp de soporte.

## 3. Precios

- Tarjetas de los 4 planes; se resalta uno (Broker) con borde tinta, sin badge chillón.
- **Toggle Mensual / Anual** ("2 meses gratis").
- Cada tarjeta muestra límites concretos: ítems, GB, usuarios y plantillas.
- Nota: "Paga con tarjeta, OXXO o transferencia SPEI. Precios en MXN".
- **CTA:** si no hay sesión → `/registro?plan=<code>`; si hay sesión → Checkout directo.

## 4. Pago (desde el panel del tenant)

- `slug.dominio.com/panel/facturacion`: plan actual, días de prueba restantes, botón "Elegir plan" → Stripe Checkout (tarjeta, OXXO o SPEI), botón "Administrar pago" → Portal de Stripe e historial de facturas.

## 5. Técnica

- Páginas estáticas o ISR. `generateMetadata` con OG image por página (`next/og`).
- Analítica: Vercel Analytics, o Plausible si se prefiere sin cookies.
- Formularios con Server Actions + zod + Turnstile.
- **Lighthouse ≥ 95** en móvil en Home y Precios.

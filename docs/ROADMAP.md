# Roadmap y tickets

**Agentes:** CC = Claude Code implementa. CX = ticket aislado y paralelizable; también lo implementa Claude Code, en una sesión aparte (Codex solo revisa). Todo PR pasa por `/codex:review`. Los tickets sensibles, además, por `/codex:adversarial-review` (ver `BUILD-WORKFLOW.md`).
**Gates:** G0 al cerrar F0, G1 al cerrar F1, G2 = demo + monitoreo (pilotos con cobro manual), G3 al cerrar F2, G4 = venta abierta.
**Estados:** ⬜ pendiente · 🟨 en curso · ✅ hecho. Actualizar al cerrar cada PR.

## F0: Seguridad, auth y provisión (bloqueante)

| ID | Ticket | Agente | Depende de | Criterios de aceptación | Estado |
|---|---|---|---|---|---|
| T00 | Setup: `lib/brand.ts`, instalar skills, tokens de `BRAND.md` en `globals.css`, fuentes Newsreader + Instrument Sans, quitar `dark` forzado, `supabase gen types` | CC | — | Build sin errores. Los tokens coinciden con BRAND §4–6. Las skills aparecen en `.claude/skills` | ✅ |
| T01 | Migración 0004: fix de grants de tenants, `plans` (+ seed de 5 planes), columnas nuevas de tenants, `tenant_members`, `usage`, `audit_log`, `is_member`, `provision_tenant`, `slug_available`, slugs reservados | CC | T00 | La anon key ya **no** lee `notes`/`stripe_*` (probar con curl). `provision_tenant` es idempotente y rechaza reservados. Tests SQL en `supabase/tests` | ✅ |
| T02 | Auth: `@supabase/ssr` con cookie `.dominio.com`, `/login`, `/recuperar`, `/auth/callback` único y redirección por rol o tenant | CC | T01 | Login en la raíz sigue activo en `slug.localhost`. Admin → `/admin`, owner → su panel | ✅ |
| T03 | Panel del tenant protegido: mover cotizador, propiedades e import a `slug./panel/*`. Rutas `api/[tenant]/*` con sesión + RLS, sin service role. Storefront público de solo lectura en `slug./` | CC | T02 | Sin sesión: `POST /api/<t>/*` → 401. Un miembro de A no puede escribir en B (test). `grep createServiceRoleClient` solo aparece en admin, webhooks, cron y provisión | ✅ |
| T04 | Registro vía A funcional (UI básica): formulario, slug en vivo, signUp con `pending_tenant` y provisión en el callback | CC | T02 | Un registro nuevo termina en `slug./panel/bienvenida` con tenant en `trialing` y `trial_ends_at` = +7 días | ✅ |
| T18 | Antiabuso: `blocked_terms` (+ seed), `normalize_slug`, `is_slug_blocked` (fuzzystrmatch), integrado en `slug_available` y `provision_tenant`, emails desechables, rate limits de registro y login (ver `ABUSE-AND-LIMITS.md`) | CC | T01 | `bbva`, `bbva-pagos`, `s4ntander`, `banortte`, `login-seguro` → bloqueados. `panaderia-lupita` → OK. Probado también llamando al RPC directo | ✅ |
| T05 | Admin vía B: "Nuevo cliente" (invite + provisión), `setTenantStatus` con auditoría y `revalidateTag`, conteos desde `usage` | CC | T01, T02 | Alta desde el admin → llega el correo → el cliente define contraseña y entra a su panel. Cada cambio deja un registro en `audit_log` | ✅ |

## F1: Infraestructura

| ID | Ticket | Agente | Depende de | Criterios de aceptación | Estado |
|---|---|---|---|---|---|
| T10 | Vercel Pro: proyecto, dominio en Cloudflare con comodín hacia Vercel (delegación `_acme-challenge`, ver PLAN §3), variables por entorno (Preview / Prod), Supabase de prod aparte | CC | F0 | `cualquier.dominio.com` responde con SSL. Los previews usan la base de staging | 🟨 |
| T11 | Caché del tenant en `proxy.ts`/layout con tag `tenant:<slug>` | CX | T10 | 0 consultas a Supabase por request con el caché caliente (verificar en logs) | ✅ |
| T12 | R2: bucket, dominio CDN en Cloudflare, `lib/r2.ts` (aws4fetch), `/api/media/sign` + `/confirm`, triggers de `usage` | CC | T01 | Subir con cuota llena → 402 con mensaje claro. El tamaño registrado es el real (HEAD) | 🟨 |
| T13 | Uploader: WebP full y thumb en el navegador, progreso, reordenar, borrar. Migrar medios existentes de Supabase Storage a R2 | CX | T12 | Una foto de 8 MB queda en ≤ 400 KB. Los medios viejos se ven igual tras migrar | 🟨 |
| T14 | `properties` → `items` (kind = property, attrs) + adaptar selector, calculadora e import de Excel (cambiar `xlsx` por `exceljs` o el build CDN de SheetJS) | CC | T01 | El cotizador broker funciona igual. Sin advisory de `xlsx` en `npm audit` | 🟨 |
| T15 | Cotizaciones: `snapshot`, `share_token`, página `/q/[token]`, PDF en el navegador, contador de vistas. Retirar el PDF del servidor y el bucket `quotes` | CC | T14 | Editar un ítem no cambia cotizaciones ya enviadas. El PDF se descarga en móvil | 🟨 |
| T16 | Mensajes de WhatsApp configurables: `message_templates`, editor con chips y vista previa, `renderMessage()` | CX | T01 | Variables reemplazadas. "Restaurar original" funciona. Máximo 1,000 caracteres | ✅ |
| T19 | Monitoreo: `/api/health` y `/deep`, Sentry, heartbeats de cron y webhooks, alertas de negocio (ver `MONITORING.md`) | CX | T12 | Una llave rota de Supabase dispara la alerta en menos de 10 minutos | 🟨 |
| T26 | Demo: `is_demo`, seeds, `/demo/entrar`, restricciones, reset nocturno, clonar demo para prospecto (ver `DEMO.md`) | CC | T15, T16 | Demo usable sin registro. El reset deja los datos iguales. Clonar crea `prospecto-x` en trial | 🟨 |
| T27 | Demo sin registro: cotización de prueba solo con nombre y sin guardar nada, capturas de marketing sin el badge de Next, home móvil y demos por giro clicables (ver `DEMO.md` §2) | CC | T26, T22 | Generar una cotización de prueba no cambia `clients` ni `quotes`. Las capturas no muestran el badge "N". Sin recortes raros en móvil | 🟨 |
| T28 | Vitrina de catálogo v2: cuadrícula con foto, búsqueda y categorías, ficha de ítem con enlace propio (`/i/<id>`) y vista previa en WhatsApp, "Mi cotización" del visitante enviada por WhatsApp (sin guardar nada), WhatsApp del negocio en Panel → Mi negocio (0029), demos con descripciones (0030) | CC | T14, T27 | Un visitante arma una lista de 3 ítems y la manda por WhatsApp en menos de 30 s en móvil. Buscar sin acentos funciona. Sin errores en consola | 🟨 |
| T17 | Cron de Vercel diario: vence pruebas, limpia huérfanos de R2, resetea `quotes_this_month` | CX | T12 | Idempotente. Protegido con `CRON_SECRET` | ✅ |

## F2: Pagos, web y onboarding

| ID | Ticket | Agente | Depende de | Criterios de aceptación | Estado |
|---|---|---|---|---|---|
| T20 | Stripe según `STRIPE.md`: `stripe-sync`, Checkout con tarjeta y SPEI (**OXXO no sirve para cobro recurrente, verificado contra Stripe real — se quitó**), webhooks idempotentes (`stripe_events`), cambios de plan con validación de uso, Portal | CC | F1 | Probado contra Stripe de prueba real: pago con tarjeta (✅ verificado), SPEI creado y facturado (✅ verificado), falla, cancelación y factura SPEI vencida | 🟨 |
| T21 | Panel → Facturación | CX | T20 | Plan, días restantes, elegir plan, portal y facturas | 🟨 |
| T22 | Web: Home, Precios, 3 landings, legales, OG images | CX + Figma | T00 | Lighthouse ≥ 95 en móvil. Pasa el checklist de BRAND §9 | 🟨 |
| T23 | Onboarding de 3 pasos (logo y color → ítems → primera cotización) | CX | T04, T13 | Se puede saltar. Se marca completo en `tenants.settings` | ✅ |
| T24 | Admin v2 completo según `ADMIN-PANEL.md` | CC | T05, T20 | MRR correcto contra Stripe. Filtros y paginación server-side | ✅ |
| T25 | Correos transaccionales con Resend y React Email: bienvenida, prueba día 5, día 7, vencida, pago fallido | CX | T17 | Plantillas con la marca, en español | 🟨 Código listo y probado (5 correos, `email_log` 0032, cron y webhook); falta verificar el dominio y poner `RESEND_API_KEY`. Pendiente: CLABE de SPEI y alerta de disputas |
| T35 | Revisión de Stripe de punta a punta en modo prueba (`npm run stripe:e2e`) y correcciones: GRANT de `stripe_checkout_session_id` (0033), no reactivar suspensiones del admin, orden de la reserva (docs/STRIPE.md §7b) | CC | T20, T21, T25 | 30/30 comprobaciones; falta teclear la tarjeta en el Checkout hospedado | ✅ |

## F3: Módulos (y después, lanzamiento)

| ID | Ticket | Agente | Depende de | Criterios de aceptación | Estado |
|---|---|---|---|---|---|
| T30 | Módulo Servicios: ítems product/service, cotización multilínea (cantidad, descuento por línea, IVA configurable) | CC | T15 | Cotización de 10 líneas en menos de 60 segundos en móvil | ✅ Cotizar en `/panel/cotizar` (catálogo a un toque, cantidad, descuento por línea, IVA 0/8/16/otro), snapshot `kind: services`, página y PDF con las 3 plantillas, demo sin guardar. Pendiente: productos con variantes/stock y descuento global |
| T31 | Plantillas base (3): web y PDF con la misma fuente de verdad (`templates.config`) | CX | T15 | Cambiar plantilla no altera montos. Se ve igual en web y PDF | ✅ 3 plantillas base (Clásica, Moderna, Editorial); web y PDF salen de `lib/quote-templates.ts` + `lib/quote-view-model.ts`; elección en Panel → Plantillas con vista previa; tope por plan en BD (0034). Fuera: plantilla premium de pago único y plantillas de Servicios (van con T30) |
| T32 | Módulo Catálogo: editor simple (portada, secciones, orden) y página pública compartible | CC | T13 | Publicar o despublicar. Carga en menos de 2 s en 4G | 🟨 Editor listo (Panel → Catálogo: alta, edición, fotos, ocultar, borrar; menú por plan); faltan portada y secciones/orden |
| T33 | Usuarios extra: invitaciones y roles, con límite por plan | CX | T03 | El trigger bloquea al superar `limits.users` | ⬜ |
| T34 | Tenant demo, QA end-to-end (Playwright) y checklist de lanzamiento | CC | todo F3 | Flujo registro → cotización → pago en verde | ⬜ |

## F4: Premium (continuo)

- Compra de plantillas premium.
- WhatsApp Cloud API para Broker Pro.
- Analítica de cotizaciones.
- CFDI con Facturapi.
- Dominio propio.
- Modo oscuro.

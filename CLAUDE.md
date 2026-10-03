@AGENTS.md

> **Manda `docs/` (leer `docs/README.md` primero).** Si algo de aquí lo contradice, gana `docs/`.
> **Regla de este archivo: máximo 200 líneas.** Si se pasa, no se recorta a ciegas: se reescribe
> compacto con solo lo necesario (lo que no se puede deducir del código) y lo demás va a `docs/`.

# AYXCO

Cotizador SaaS multi-tenant para brokers inmobiliarios (y otros giros): calculadora financiera,
mini-CRM, dossier PDF, envío por WhatsApp, suscripción por tenant y admin master en `/admin`.
Arquitectura y arranque: [README.md](./README.md). Tickets y estado: `docs/ROADMAP.md`
(un ticket = una rama = un PR apilado; ciclo en `docs/BUILD-WORKFLOW.md`).

## Marca y UI

- Nombre y dominio solo en [lib/brand.ts](./lib/brand.ts) (`AYXCO`, `ayxco.app`; el
  dominio sale de `NEXT_PUBLIC_ROOT_DOMAIN`). Nunca hardcodeados.
- Paleta "papel y tinta" de `docs/BRAND.md` §4–7, solo en `app/globals.css`. Nada de hex ni
  colores crudos de Tailwind: `text-danger`, `text-ok`, `text-warn`, `bg-accent`. Fuentes
  Newsreader (titulares) + Instrument Sans. Textos en español de México.
- El PDF ([pdf/QuoteDocument.tsx](./pdf/QuoteDocument.tsx)) es excepción intencional (pág. 1
  clara, pág. 2 oscura): no lo "corrijas". Recalcula montos en servidor con `lib/pricing.ts`;
  nunca confíes en los del navegador. Ya no se genera en el servidor (T15): `lib/pdf-client.ts` lo arma
  en el navegador desde el snapshot (re-codifica las imágenes a JPEG por canvas; el CDN de medios
  necesita CORS `GET`).

## Next.js 16

`middleware.ts` no existe: se llama [`proxy.ts`](./proxy.ts) y exporta `proxy()`. Antes de tocar
rutas o config, lee `node_modules/next/dist/docs/`. `revalidateTag(tag, perfil)` exige 2.º argumento: para autorización usa `{ expire: 0 }` (`'max'` sirve contenido viejo mientras revalida).

## Multi-tenant

- El slug viaja en el subdominio (`slug.ayxco.app`, `slug.localhost:3100`); `proxy.ts` lo
  reescribe a `/[tenant]/...`. No inventes rutas con prefijo.
- `tenants.status`: `trialing | active | past_due | suspended | canceled`.
  `OPERABLE_TENANT_STATUSES` ([lib/tenants.ts](./lib/tenants.ts): active, trialing, past_due) es la
  única lista de estados "vivos": úsala en toda ruta que resuelva tenant por slug.
  Layouts y páginas usan `requireOperableTenant` (`lib/tenant-page.ts`): un layout no frena el render de sus hijos, así que cada segmento lo llama; `suspended` redirige a `/suspended` del dominio raíz y el resto cae en `notFound()`.
- Caché del tenant (T11): `getTenantAnyStatus`/`getTenantBySlug` usan `unstable_cache` con tag
  `tenant:<slug>` (TTL de respaldo 300 s). Todo cambio de estado, alta o dato público del tenant
  debe llamar `revalidateTag(tenantTag(slug), { expire: 0 })` (también webhooks y cron futuros). `proxy.ts`
  ya no consulta la base. El estado en caché puede ir atrasado; RLS (`can_write`) es la verdad.
- Rutas: `slug./` storefront público de solo lectura; `slug./panel/*` panel (sesión + membresía,
  gate en `app/[tenant]/panel/layout.tsx` y `lib/auth/panel.ts`); `/login`, `/recuperar`,
  `/registro`, `/auth/*`, `/admin` en el dominio raíz.

## Supabase: tres clientes, a propósito ([lib/supabase/server.ts](./lib/supabase/server.ts))

1. Anon (`createServerSupabaseClient`): lecturas públicas; respeta RLS.
2. Sesión (`createSessionSupabaseClient`, `@supabase/ssr`): TODO lo que escribe un usuario
   logueado (panel y `/api/[tenant]/*`). RLS con `is_member` / `can_write` es la barrera real.
3. Service role (`createServiceRoleClient`): SOLO `app/api/admin/*`, webhooks, cron y
   provisión de tenants, más `lib/media-store.ts` (RPC de medios, solo tras validar sesión, rol
   editor y el HEAD real en R2), más `slug_available`/`get_shared_quote`/`get_quote_tenant_slug`
   (`/registro`, `/api/slug-available`, `slug./q/[token]`, `/q/[token]`): son lecturas ya públicas
   por sí mismas (RPC `security definer`) y usan la llave de servicio solo para que su propio
   respaldo por IP (0024) no confunda la IP de salida de Vercel con la del visitante — Upstash ya
   limita por la IP real antes de llegar aquí. Nunca en `app/api/[tenant]/*`.

- `tenants` usa allow-list de columnas (`GRANT SELECT (...)`): una columna nueva sensible no
  alcanza con RLS, hay que dejarla fuera del grant. `notes` nunca llega a nadie; `stripe_*` y
  `plan_id` sí a `authenticated` (su propio tenant, vía RLS), nunca a `anon`.
- Migraciones 0001 → 0034 en `supabase/migrations` (detalle en cada archivo; 0029 `tenants.whatsapp`, 0030 demos; las
  más recientes: 0025 (T20) agrega `stripe_events`, `subscriptions`, `expire_past_due()` y
  `reserve_stripe_checkout`; 0026 agrega `stripe_checkout_session_id`; 0027 (T23) agrega
  `set_tenant_logo`/`update_tenant_branding`/`dismiss_onboarding` — todas validan membresía ellas
  mismas porque las llama el cliente de sesión, nunca service role, salvo `set_tenant_logo`, que
  solo la llama `/api/media/confirm` ya autenticado). Se aplican con
  `supabase db push --linked`. Tests pgTAP en `supabase/tests` (sin Docker se corren por
  MCP/`supabase db query --linked -f` con rollback forzado por un `DO` final que lanza
  `RES total=% failed=%`).
- Tipos: `supabase gen types typescript --linked > lib/database.types.ts` tras cada migración.
- Storage de Supabase: sin buckets en uso (`quotes` retirado en T15; `property-media` sin políticas
  desde 0012) — los medios van a R2. Un trigger exige que `images`/`floor_plan_url` de usuarios ya
  existan en el ítem; solo el servidor agrega URLs (`attach_media_url`, o `set_tenant_logo` para el
  logo de tenant, T23).
- Medios en R2 (T12): `/api/media/sign` → PUT directo a R2 → `/api/media/confirm` (HEAD real,
  `confirm_media`) y `DELETE /api/media/[id]`. Cuota por plan en BD (`reserve_media`,
  `effective_limit`: en prueba manda el tope de `plans.trial`); `usage.storage_bytes` lo mantiene
  `trg_media_usage`. Llaves `t/<tenant>/<item|_>/<uuid>-{full|thumb}.webp`. El navegador convierte a
  WebP antes de subir (`lib/image-client.ts`, `lib/media-client.ts`); react-pdf no lee WebP, así que
  la conversión a JPEG del PDF (T15) vive en `lib/pdf-client.ts`. `presignPut` firma también
  `Content-Type`/`Content-Length`; el HEAD al confirmar mide el tamaño real (nunca el que declaró
  el navegador).
- Cotizaciones (T15): `quotes.snapshot` (`lib/quote-snapshot.ts`) congela todo lo que muestran la página
  `slug./q/<token>` (subdominio del tenant, pública, rate limit `share`; `app/q/[token]` en el dominio
  raíz solo redirige ahí) y el PDF; editar el ítem no la cambia. Los usuarios solo LEEN `quotes`: las
  crea `POST /api/[tenant]/quotes` con service role (`lib/quote-store.ts`, montos recalculados; el
  trigger `quotes_quota_guard` da número consecutivo y tope diario). `get_shared_quote(token)` (anon)
  suma vistas y marca `viewed`, y ya no devuelve el snapshot de una cotización vencida; vigencia 30 días.
  El estado `expired` no se escribe solo: el panel de cotizaciones lo deriva de `expires_at` al listar.
  `slug./q/<token>` pinta marca (`tenantName`/`tenantLogoUrl`/`brandColor`) desde `snap`, nunca desde
  la fila viva de `tenants`: si el tenant cambia nombre/logo/color después, la página no debe verse
  distinta del PDF ya descargado con la marca de ese momento.
  Plantillas (T31, `lib/quote-templates.ts`): una config para web (`components/quote/quote-view.tsx`) y PDF (`pdf/QuoteDocument.tsx`) sobre `lib/quote-view-model.ts` (sin plantilla: no altera montos); elegida en `tenants.quote_template` y congelada en el snapshot.
- Mensajes (T16): `message_templates` (tenant_id, module, channel='whatsapp', body ≤1000, sin HTML), una fila
  por módulo del plan (`provision_tenant` las crea; solo editor escribe). `lib/message-templates.ts`
  (`renderMessage`, `DEFAULT_TEMPLATES`) resuelve `{variable}` sin tocar las desconocidas; `POST
  /api/[tenant]/quotes` la usa para el link de wa.me. Editor en Panel → Mensajes (`tenant_modules`).
- Correos (T25, DEPLOY §2c-bis): `lib/email/notifyTenant` reclama `email_log` antes de enviar (Resend) y lo suelta si falla;
  plantillas en `emails/`. Salen del cron diario, de `provisionTenant` y del webhook. Sin `RESEND_API_KEY`, no hace nada.
- Demo (T26): `is_demo` en tenants, visible en las columnas públicas. `reset_demo_data(password)`
  (0020) borra y recrea los 8 tenants `demo-*`; lo llaman `npm run seed:demo` (dueño), el cron
  `/api/cron/reset-demo` (diario) y el botón "Resetear demo" en `/admin`. `DEMO_PASSWORD` debe ser
  la misma en el seed y en el entorno de la app: `/demo/entrar` inicia sesión con ella como el
  editor de `demo-broker` (la vitrina). `is_demo` bloquea subir/borrar medios; banner y modo
  `?present=1` en `components/demo-banner.tsx`. Admin → "Clonar como prospecto" copia catálogo y
  marca a un tenant nuevo en trial (`clone_demo_items`, docs/DEMO.md).
  La cotización en demo (T27) NO se guarda: solo nombre, `POST /api/[tenant]/quotes` devuelve el
  snapshot sin `createQuote` y `/clients` POST da 403 (`lib/demo-quote.ts`); la sesión es compartida.
- Vitrina y catálogo (T28/T32): `slug./` = `CatalogBrowser`, `slug./i/<id>` = ficha; "Mi cotización" vive en
  `localStorage` (`lib/cart-store.ts`) y sale como texto de WhatsApp a `tenants.whatsapp` (0029/0031, Panel →
  Mi negocio); nada escribe en la base. Panel → Catálogo (`/panel/catalogo`): alta/edición/fotos de productos y
  servicios (`/api/[tenant]/items[/<id>[/images]]`, `lib/item-input.ts`; tipos permitidos por módulo del plan).
  El menú del panel sigue `tenant_modules` (`getPanelModules`): sin `broker` no hay cotizador ni propiedades.
- Cron diario (T17): `/api/cron/daily` (`CRON_SECRET`): `expire_trials()` (trialing vencido sin `stripe_subscription_id`,
  no `is_demo` → `suspended`, `status_reason='trial_expired'`), `reset_monthly_quote_counters()` y `cleanupOrphanedMedia()`
  (`lib/media-cleanup.ts`: `media` `pending` sin confirmar y objetos de R2 sin fila tras una hora). Monitoreo (T19):
  `docs/MONITORING.md` (health, Sentry, heartbeats de los cron).
- Stripe (T20, `docs/STRIPE.md`): `lib/stripe.ts` (`getStripe`/`stripeConfigured`, sin `apiVersion`
  fija). `npm run stripe:sync` crea/actualiza Products+Prices. `POST /api/[tenant]/billing/{checkout,portal}`
  (`anyStatus: true`: suspended/canceled necesita pagar) usan el cliente de sesión, nunca service
  role; `checkout` rechaza si ya hay `stripe_subscription_id` y bloquea downgrades con
  `plan_usage_overages`. **OXXO no sirve para cobro recurrente** (verificado contra Stripe real) —
  solo tarjeta (Checkout) y SPEI (`stripe.subscriptions.create` con `send_invoice` +
  `invoices.finalizeInvoice`, nunca Checkout). `/api/stripe/webhook` (`lib/stripe-webhook.ts`):
  idempotencia por `stripe_events` marcada DESPUÉS de los efectos; `checkout.session.completed` solo
  activa si `payment_status === "paid"`; `.subscription.created/updated` liga `stripe_customer_id`/
  `plan_id` (respaldo de cuota: los triggers, docs/STRIPE.md §4); `.deleted` limpia
  `stripe_subscription_id`; `invoice.overdue` es el equivalente SPEI de `payment_failed`.
  `reserve_stripe_checkout` evita duplicar suscripciones por doble POST; para tarjeta también se
  expira en Stripe la Checkout Session anterior (`stripe_checkout_session_id`, 0026) antes de crear
  otra (hallazgo de Codex). Pendiente: correo transaccional para `invoice.finalized`/disputas. Revisado de punta a punta (T35): `npm run stripe:e2e`, docs/STRIPE.md §7b; un pago no reactiva suspensiones del admin.
- Panel → Facturación (T21): `/panel/facturacion` es la ÚNICA página de `/panel/*` que un tenant
  suspended/canceled puede ver (necesita pagar ahí para reactivarse) — `requireOperableTenant`
  (`lib/tenant-page.ts`) y `getPanelContext` (`lib/auth/panel.ts`) toman un segundo argumento
  `anyStatus`; el layout lo activa leyendo `x-tenant-pathname` y debe llamarlo con el mismo valor
  exacto que la página (`React.cache` compara con `Object.is`, si no se duplica la consulta).
  **Local:** `slug.localhost:3100/panel` hace loop (cookie `Domain=localhost`); en Playwright inyecta la cookie en `slug.localhost`.
- Ítems (T14): tabla `items` (`kind` product|service|property; `attrs` jsonb; `images`/`floor_plan_url`; `sku`
  único por tenant). Propiedades usan el tipo `Property` (`lib/items.ts#itemToProperty`/`importRowToItem`); la
  lectura pública oculta `status='hidden'`. Import de Excel: `exceljs` (`lib/import-properties.ts`).

## Auth y registro

- Login único (`/login`: contraseña o magic link) y `/auth/callback` (acepta `code` y
  `token_hash`+`type`). Cookie de sesión en el dominio raíz (`lib/auth/cookie-domain.ts`) para
  que `slug./panel` la lea. Todo `next`/redirect pasa por `safeNext` (`lib/auth/redirects.ts`).
- Plantillas de correo en `supabase/templates/` (usan `.RedirectTo`); requieren `supabase config
  push`. `additional_redirect_urls` debe incluir el dominio raíz y `*.dominio`.
- Registro (`/registro`): `signUp` con `pending_tenant` en `user_metadata`; el callback lo
  provisiona (`lib/auth/provision.ts` → `provision_tenant`, `trialing`, 7 días). `pending_tenant`
  lo escribe el usuario: siempre se revalida (`parsePendingTenant`). Una prueba por dueño y
  escrituras solo en tenants operables se imponen en BD. Turnstile opcional por entorno.
- Anti-abuso: `is_slug_blocked`, correos desechables, rate limits Upstash
  (`lib/rate-limit.ts`, fail-open sin Redis). El slug en vivo usa el bucket `slug`.
- Onboarding (T23, `/panel/bienvenida`): wizard de 3 pasos (logo y color → ítems → primera
  cotización); cada paso se marca completo con datos reales (`logo_url`, `usage.items_count`,
  existe una cotización) — solo "saltar" se persiste, en `tenants.settings.onboarding_skipped`
  (RPC `dismiss_onboarding`). El logo reusa el pipeline de medios con `kind: "logo"` e
  `itemId: null` (ya contemplado desde T12/T13; solo faltaba ligar la URL confirmada a
  `tenants.logo_url`, `set_tenant_logo`). El color pasa por `PATCH /api/[tenant]/branding` → RPC
  `update_tenant_branding` (nunca RLS de tabla directa sobre `tenants`). `logo_url`/`brand_color`
  son columnas públicas cacheadas: ambas rutas llaman `revalidateTag`.

## Admin (`/admin`)

- `getAdminUser()` ([lib/admin-auth.ts](./lib/admin-auth.ts)) es el único gate de `app/api/admin/*`,
  que usa service role (ignora RLS): va en la primera línea. No hay signup de admins: usuario en
  Auth + `insert into app_admins`.
- "Nuevo cliente" = `POST /api/admin/tenants` (invita al dueño y llama `provision_tenant`,
  `source = 'admin'`). Todo cambio de estado pasa por `setTenantStatus` (`lib/admin-status.ts`,
  RPC `set_tenant_status` con auditoría atómica; suspender/cancelar exigen motivo) y luego
  `revalidateTag(tenantTag(slug), { expire: 0 })`. Conteos desde `usage` (triggers), no contando filas.
- Admin v2 (`docs/ADMIN-PANEL.md`): gate en `app/admin/layout.tsx` (no en `page.tsx`), nav de 5
  secciones. `lib/admin-kpis.ts#getAdminKpis` calcula MRR/conteos/conversión de prueba/almacenamiento
  en JS —sin migración nueva, la escala de hoy no la justifica—; `computeMrr`/`computeTrialConversion`
  son puras y con tests. `listTenantsForAdminPaged` (`lib/admin-tenants.ts`): búsqueda/filtros/`.range()`
  server-side en `/admin/clientes`. Cliente-detalle: cambiar plan/extender prueba escriben directo con
  service role (PATCH extendido de `.../tenants/[tenantId]/route.ts`, sin RPC nueva); "entrar como
  soporte" es sesión completa auditada (`.../impersonate` arma `/auth/callback` con
  `generateLink().properties.hashed_token`, nunca el `action_link` hosteado de Supabase); uso = solo
  mes en curso. Planes: CRUD real (`/api/admin/plans*`), nunca DELETE — `public=false` es "borrar".
  Pagos: una sola llamada a `stripe.invoices.list` cruzada con `subscriptions` local. Auditoría
  (`lib/admin-audit.ts`): paginada, resuelve el email del actor con `auth.admin.getUserById`.

## Entorno local

- Variables en `.env.local` (ver `.env.example`). Las keys de Supabase usan formato nuevo
  (`sb_publishable_...`, `sb_secret_...`); ambos formatos funcionan.
- Dev server: `.claude/launch.json` (puerto 3100). Otro `next dev` viejo (p. ej. en 4000) puede
  tener env vars obsoletas: si "Tenant no encontrado" con datos que existen, reinícialo.
- Despliegue (Vercel, Cloudflare, Supabase prod): `docs/DEPLOY.md`.

## Flujo de trabajo

- Commits `tipo(área): descripción` en español; PR apilado por ticket (`f<fase>/<id>-<slug>`).
- Sin mensajes intermedios largos: trabajar hasta el final y dar un resumen breve.
- Revisiones `/codex:review` y `/codex:adversarial-review` (tickets sensibles) las corre el dueño.

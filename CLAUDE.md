@AGENTS.md

> **Manda `docs/` (leer `docs/README.md` primero).** Si algo de aquí lo contradice, gana `docs/`.
> **Regla de este archivo: máximo 200 líneas.** Si se pasa, no se recorta a ciegas: se reescribe
> compacto con solo lo necesario (lo que no se puede deducir del código) y lo demás va a `docs/`.

# AYX Cotiza

Cotizador SaaS multi-tenant para brokers inmobiliarios (y otros giros): calculadora financiera,
mini-CRM, dossier PDF, envío por WhatsApp, suscripción por tenant y admin master en `/admin`.
Arquitectura y arranque: [README.md](./README.md). Tickets y estado: `docs/ROADMAP.md`
(un ticket = una rama = un PR apilado; ciclo en `docs/BUILD-WORKFLOW.md`).

## Marca y UI

- Nombre y dominio solo en [lib/brand.ts](./lib/brand.ts) (`AYX Cotiza`, `ayx.solutions`; el
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

- El slug viaja en el subdominio (`slug.ayx.solutions`, `slug.localhost:3100`); `proxy.ts` lo
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
   editor y el HEAD real en R2). Nunca en `app/api/[tenant]/*`.

- `tenants` usa allow-list de columnas (`GRANT SELECT (...)`): una columna nueva sensible no
  alcanza con RLS, hay que dejarla fuera del grant. `notes` y `stripe_*` nunca llegan a anon.
- Migraciones 0001 → 0018 (0015: topes de plan por kind y cotizaciones/día en triggers; `media.item_id` con FK) en `supabase/migrations`; se aplican con `supabase db push --linked`.
  Tests pgTAP en `supabase/tests` (sin Docker se corren por MCP/`supabase db query --linked -f`
  con rollback forzado por un `DO` final que lanza `RES total=% failed=%`).
- Tipos: `supabase gen types typescript --linked > lib/database.types.ts` tras cada migración.
- Storage de Supabase: ya sin buckets en uso (`quotes` se retiró en T15 con
  `scripts/remove-quotes-bucket.mjs`; `property-media` sin políticas desde 0012): los medios van a R2. Un trigger obliga a que `images`/`floor_plan_url`
  escritas por usuarios existan ya en la propiedad; solo el servidor agrega URLs (`attach_media_url`).
- Medios en R2 (T12): `/api/media/sign` → PUT directo a R2 → `/api/media/confirm` (HEAD real,
  `confirm_media`) y `DELETE /api/media/[id]`. Cuota por plan en BD (`reserve_media`,
  `effective_limit`: en prueba manda el tope de `plans.trial`); `usage.storage_bytes` lo mantiene
  `trg_media_usage`. Llaves `t/<tenant>/<item|_>/<uuid>-{full|thumb}.webp`. El navegador convierte a
  WebP (full ≤ 2000 px y ~380 KB, thumb 480 px) antes de subir (`lib/image-client.ts`,
  `lib/media-client.ts`). react-pdf no lee WebP; el PDF ya no se genera en el servidor (T15), así que
  la conversión a JPEG vive en `lib/pdf-client.ts`. `aws4fetch` no ata el tamaño a la firma por sí
  solo: `presignPut` firma también `Content-Type`/`Content-Length`, y el HEAD al confirmar mide el
  tamaño real.
- Cotizaciones (T15): `quotes.snapshot` (`lib/quote-snapshot.ts`) congela todo lo que muestran la página
  `slug./q/<token>` (subdominio del tenant, pública, rate limit `share`; `app/q/[token]` en el dominio
  raíz solo redirige ahí) y el PDF; editar el ítem no la cambia. Los usuarios solo LEEN `quotes`: las
  crea `POST /api/[tenant]/quotes` con service role (`lib/quote-store.ts`, montos recalculados; el
  trigger `quotes_quota_guard` da número consecutivo y tope diario). `get_shared_quote(token)` (anon)
  suma vistas y marca `viewed`, y ya no devuelve el snapshot de una cotización vencida; vigencia 30 días.
- Mensajes (T16): `message_templates` (tenant_id, module, channel='whatsapp', body ≤1000, sin HTML)
  con una fila por módulo del plan (`provision_tenant` las crea; solo editor escribe, solo servicio
  agrega/quita módulos). `lib/message-templates.ts` (`renderMessage`, `DEFAULT_TEMPLATES`) resuelve
  `{variable}` sin tocar las desconocidas; `POST /api/[tenant]/quotes` la usa para el link de wa.me.
  Editor en Panel → Mensajes (`tenant_modules(tenant_id)` dice qué módulos mostrar).
- Demo: `npm run seed:demo` (`scripts/seed-demo.mjs` + `supabase/seed/demo.sql`) crea 8 tenants `demo-*`
  (uno por plan/estado) con usuarios `rol.plan@demo.ayx.test`; ver `docs/DEMO.md` §4.1.
- Ítems (T14): tabla `items` (`kind` product|service|property; `attrs` jsonb; `images`/`floor_plan_url`;
  `sku` único por tenant, en propiedades = unidad). La UI de propiedades sigue usando el tipo `Property`
  vía `lib/items.ts` (`itemToProperty`, `importRowToItem`); consultas con `.eq("kind","property")`. La
  lectura pública oculta `status = 'hidden'`. Import de Excel: `exceljs` (`lib/import-properties.ts`).

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

## Admin (`/admin`)

- `getAdminUser()` ([lib/admin-auth.ts](./lib/admin-auth.ts)) es el único gate de `app/api/admin/*`,
  que usa service role (ignora RLS): va en la primera línea. No hay signup de admins: usuario en
  Auth + `insert into app_admins`.
- "Nuevo cliente" = `POST /api/admin/tenants` (invita al dueño y llama `provision_tenant`,
  `source = 'admin'`). Todo cambio de estado pasa por `setTenantStatus` (`lib/admin-status.ts`,
  RPC `set_tenant_status` con auditoría atómica; suspender/cancelar exigen motivo) y luego
  `revalidateTag(tenantTag(slug), { expire: 0 })`. Conteos desde `usage` (triggers), no contando filas.

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

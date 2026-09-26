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
  nunca confíes en los del navegador. Corre en runtime Node (`export const runtime = "nodejs"`).

## Next.js 16

`middleware.ts` no existe: se llama [`proxy.ts`](./proxy.ts) y exporta `proxy()`. Antes de tocar
rutas o config, lee `node_modules/next/dist/docs/`. `revalidateTag(tag, 'max')` exige 2.º argumento.

## Multi-tenant

- El slug viaja en el subdominio (`slug.ayx.solutions`, `slug.localhost:3100`); `proxy.ts` lo
  reescribe a `/[tenant]/...`. No inventes rutas con prefijo.
- `tenants.status`: `trialing | active | past_due | suspended | canceled`.
  `OPERABLE_TENANT_STATUSES` ([lib/tenants.ts](./lib/tenants.ts): active, trialing, past_due) es la
  única lista de estados "vivos": úsala en toda ruta que resuelva tenant por slug.
  `suspended` muestra `SuspendedView` desde `app/[tenant]/layout.tsx`; el resto cae en `notFound()`.
- Caché del tenant (T11): `getTenantAnyStatus`/`getTenantBySlug` usan `unstable_cache` con tag
  `tenant:<slug>` (TTL de respaldo 300 s). Todo cambio de estado, alta o dato público del tenant
  debe llamar `revalidateTag(tenantTag(slug), 'max')` (también webhooks y cron futuros). `proxy.ts`
  ya no consulta la base. El estado en caché puede ir atrasado; RLS (`can_write`) es la verdad.
- Rutas: `slug./` storefront público de solo lectura; `slug./panel/*` panel (sesión + membresía,
  gate en `app/[tenant]/panel/layout.tsx` y `lib/auth/panel.ts`); `/login`, `/recuperar`,
  `/registro`, `/auth/*`, `/admin` en el dominio raíz.

## Supabase: tres clientes, a propósito ([lib/supabase/server.ts](./lib/supabase/server.ts))

1. Anon (`createServerSupabaseClient`): lecturas públicas; respeta RLS.
2. Sesión (`createSessionSupabaseClient`, `@supabase/ssr`): TODO lo que escribe un usuario
   logueado (panel y `/api/[tenant]/*`). RLS con `is_member` / `can_write` es la barrera real.
3. Service role (`createServiceRoleClient`): SOLO `app/api/admin/*`, webhooks, cron y
   provisión de tenants. Nunca en `app/api/[tenant]/*`.

- `tenants` usa allow-list de columnas (`GRANT SELECT (...)`): una columna nueva sensible no
  alcanza con RLS, hay que dejarla fuera del grant. `notes` y `stripe_*` nunca llegan a anon.
- Migraciones 0001 → 0009 en `supabase/migrations`; se aplican con `supabase db push --linked`.
  Tests pgTAP en `supabase/tests` (sin Docker se corren por MCP/`supabase db query --linked -f`
  con rollback forzado por un `DO` final que lanza `RES total=% failed=%`).
- Tipos: `supabase gen types typescript --linked > lib/database.types.ts` tras cada migración.
- Storage: buckets `quotes` (solo PDF, 10 MB) y `property-media` (imágenes sin SVG, 5 MB). La
  primera carpeta del objeto es el `tenant_id`; los objetos no se borran por SQL (`protect_delete`).
  Un trigger obliga a que `images`/`floor_plan_url` escritas por usuarios sean de su carpeta.
- `xlsx` (SheetJS) tiene un advisory sin fix oficial (se reemplaza en T14).

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
  `revalidateTag('tenant:<slug>', 'max')`. Conteos desde `usage` (triggers), no contando filas.

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

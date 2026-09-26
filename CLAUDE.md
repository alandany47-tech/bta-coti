@AGENTS.md

> **Documentación objetivo en `docs/` (leer `docs/README.md` primero).** Si algo de este archivo
> contradice `docs/`, manda `docs/`: este archivo describe el estado del MVP previo a F0.


# AYX Cotiza

Cotizador multi-tenant para brokers inmobiliarios de lujo (cartera de hasta
10 propiedades por tenant, vía Excel + fotos/plano en Supabase Storage),
calculadora financiera en tiempo real, mini-CRM de clientes, dossier en PDF
de 2 páginas y envío por WhatsApp. Incluye control de suscripción por tenant
(trial/activo/moroso/suspendido/cancelado) y un Panel de Administración
Master en `/admin` para operar la cartera de clientes del SaaS. Ver
[README.md](./README.md) para la arquitectura completa y cómo levantar el
proyecto.

## Convenciones específicas de este repo

- **Next.js 16, no 14.** `middleware.ts` no existe en esta versión: el
  archivo se llama [`proxy.ts`](./proxy.ts) y exporta `proxy()` en vez de
  `middleware()`. Antes de tocar rutas, App Router o config, revisa
  `node_modules/next/dist/docs/` (AGENTS.md ya lo recuerda arriba).
- **Multi-tenant por subdominio**: `proxy.ts` reescribe `cliente1.localhost:3000`
  o `cliente1.ayx.solutions` a `/[tenant]/...`. No inventes rutas `/tenant/`
  con path prefix manual: el slug siempre viaja en el subdominio.
- **Tres formas de hablar con Supabase, a propósito**
  ([lib/supabase/server.ts](./lib/supabase/server.ts)): anon key
  (`createServerSupabaseClient`) para lecturas públicas (storefront y resolución
  de tenant; respeta RLS), sesión de Supabase Auth (`createSessionSupabaseClient`,
  vía `@supabase/ssr`) para TODO lo que escribe un usuario logueado (panel del
  tenant y `/api/[tenant]/*`, protegido por RLS con `is_member`), y service role
  (`createServiceRoleClient`) SOLO en `app/api/admin/*`, webhooks, cron y la
  provisión de tenants. Nunca uses la service role en `app/api/[tenant]/*`.
- **Login único (T02)**: `/login` (contraseña o magic link, Server Actions con rate
  limit), `/recuperar` y `/auth/callback` (acepta `code` y `token_hash`+`type`) sirven
  a admins y a miembros de tenants. La cookie de sesión se fija en el dominio raíz
  (`lib/auth/cookie-domain.ts`: `.dominio.com` y `localhost` en local) para que
  `slug.dominio.com/panel` la lea. Todo `next`/redirect pasa por `safeNext` en
  `lib/auth/redirects.ts`; nunca redirijas a una URL sin validarla ahí. Las
  plantillas de correo de `supabase/templates/` deben estar aplicadas en el proyecto
  (`supabase config push`) para que invitaciones y recuperaciones lleguen al callback.
- **`/admin` sí tiene auth real** (a diferencia del cotizador público, ver
  el punto de abajo): Supabase Auth con cookies (`@supabase/ssr`) + la tabla
  `app_admins` (migración
  [0003_subscriptions_and_admin.sql](./supabase/migrations/0003_subscriptions_and_admin.sql)).
  `getAdminUser()` en [lib/admin-auth.ts](./lib/admin-auth.ts) es el único
  gate de `app/api/admin/*` — esas rutas usan service role, que ignora RLS
  por completo, así que si se le saca ese chequeo cualquiera con la sesión
  activa (o sin sesión) podría leer/editar todos los tenants. No hay signup:
  un admin se da de alta a mano — creá el usuario en Supabase Auth (dashboard
  o Admin API) y después `insert into app_admins (user_id) values (...)`.
  Las columnas `notes`/`stripe_customer_id`/`stripe_subscription_id` de
  `tenants` están recortadas por `REVOKE SELECT` a nivel de columna para el
  rol `anon`; si agregas una columna sensible nueva a `tenants`, revísalo ahí
  también, no alcanza con la policy de RLS.
- **Kill-switch de suscripción en proxy.ts**: `tenants.status` vive en
  `trialing | active | past_due | suspended | canceled` (antes era
  `active | inactive`). Si el tenant está `suspended`, `proxy.ts` reescribe
  CUALQUIER ruta de su subdominio a `/suspended` antes de llegar a
  `[tenant]/layout.tsx`. Los demás estados no operables (`past_due`,
  `canceled`, o el tenant no existe) siguen cayendo al `notFound()` de
  siempre — `OPERABLE_TENANT_STATUSES` en [lib/tenants.ts](./lib/tenants.ts)
  es la lista de estados "vivos" (hoy `active` y `trialing`; un tenant en
  trial sí debe poder mostrar su storefront). Los 6 lugares que antes
  filtraban `.eq("status", "active")` (Route Handlers + `getTenantBySlug`)
  usan ahora `OPERABLE_TENANT_STATUSES` — si agregás una ruta nueva que
  resuelva tenant por slug, importá esa constante en vez de hardcodear
  `"active"`.
- **Registro (T04)**: `/registro` hace `signUp` con `pending_tenant` en `user_metadata`;
  `/auth/callback` lo provisiona con `lib/auth/provision.ts` (`provision_tenant`, `trialing`,
  7 días). `pending_tenant` lo escribe el usuario: siempre se revalida con
  `parsePendingTenant` (plan solo `esencial|catalogo|broker`). Una prueba por dueño y las
  escrituras solo en tenants `active|trialing` se imponen en BD (0007: `can_write`,
  `trial_used`). Turnstile es opcional por entorno (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`).
  La validación en vivo del slug usa el bucket `slug`, no `register`.
- **Panel del tenant protegido (T03)**: el cotizador, las propiedades y el import
  viven en `slug./panel`, `/panel/propiedades` y `/panel/importar` (layout con
  gate en `app/[tenant]/panel/layout.tsx` + `lib/auth/panel.ts`); `slug./` es el
  storefront público de solo lectura. Toda ruta `app/api/[tenant]/*` empieza con
  `requireTenantAccess(slug, rol)` de `lib/auth/api.ts` (401 sin sesión, 403 sin
  rol) y escribe con el cliente de sesión: RLS de
  [0006_tenant_rls.sql](./supabase/migrations/0006_tenant_rls.sql) es la barrera
  real. Roles: `viewer` crea cotizaciones y clientes; `editor` escribe
  propiedades, medios e importa. `clients` es PII: sin policies para anon.
  Storage (`quotes`, `property-media`): la primera carpeta del objeto es el
  `tenant_id` y las policies de `storage.objects` lo comparan con `is_member`.
  Los objetos de Storage no se borran por SQL (`protect_delete`), solo por la API.
- **Migraciones**: 0001 → 0007 en orden. Las escribe el repo y se aplican con
  `supabase db push --linked` (0002/0003 se marcaron con `migration repair`).
- **PDF en runtime Node**: `@react-pdf/renderer` no corre en Edge. La ruta
  `app/api/[tenant]/quotes/route.ts` declara `export const runtime = "nodejs"`;
  no lo quites. El dossier ([pdf/QuoteDocument.tsx](./pdf/QuoteDocument.tsx))
  recalcula el precio/desglose en el servidor con
  [lib/pricing.ts](./lib/pricing.ts) — nunca confíes en los montos que manda
  el navegador.
- **Paleta clara "papel y tinta" (T00)**: los tokens de `docs/BRAND.md` §4–7 viven
  solo en `app/globals.css` (`--paper`, `--ink`, `--accent`, …); los nombres
  legados (`bg-background`, `text-foreground`, `text-muted`, …) son alias de
  esos tokens. Nada de hex ni colores crudos de Tailwind en componentes: usa
  `text-danger`, `text-ok`, `text-warn`, `bg-accent`. Fuentes Newsreader
  (titulares) + Instrument Sans (UI); el nombre y dominio de marca salen de
  `lib/brand.ts`. El PDF es la excepción intencional: página 1 es fondo claro
  con bloques de acento oscuro, página 2 (galería) es full-dark; no lo
  "corrijas" para que combine con `globals.css`.
- **Storage**: dos buckets públicos — `quotes` (PDFs generados) y
  `property-media` (hasta 10 imágenes + 1 plano por propiedad, creado en
  0002). Las subidas de medios pasan por
  [`/api/[tenant]/properties/[propertyId]/media`](./app/api/[tenant]/properties/[propertyId]/media/route.ts)
  (valida 5MB server-side, no solo en el cliente).

## Entorno local

- Variables en `.env.local` (ver [.env.example](./.env.example)): 3 keys de
  Supabase + `NEXT_PUBLIC_ROOT_DOMAIN` + `NEXT_PUBLIC_SUPPORT_WHATSAPP`
  (opcional, número de soporte de BTA que se muestra en `app/suspended`; sin
  esa var el botón de WhatsApp simplemente no se renderiza).
- `DATABASE_URL` (connection string directo a Postgres, Project Settings →
  Database → Connection string → URI en el dashboard de Supabase) es
  opcional y NO la usa la app — solo sirve para correr migraciones nuevas
  desde un script local (`node` + el paquete `pg`, no está en
  `package.json` a propósito porque no lo usa la app en runtime) en vez de
  pegarlas a mano en el SQL Editor del dashboard. No commitear.
- Las keys de Supabase de este proyecto usan el formato nuevo
  (`sb_publishable_...` para `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `sb_secret_...` para `SUPABASE_SERVICE_ROLE_KEY`), no el JWT legacy
  (`eyJ...`) que muestra `.env.example` como placeholder. Ambos formatos
  funcionan igual con el SDK, no asumas que una key sin prefijo `eyJ` está mal.
- Si trabajas en esta máquina junto con el proyecto `admin-inmobiliario`, ese
  repo también usa el puerto 3000 por defecto — arranca este con
  `PORT=<otro-puerto> npm run dev` si ambos corren a la vez.
- En esta máquina suele quedar un `next dev` de este proyecto corriendo en
  segundo plano en el puerto **4000** (fuera de `.claude/launch.json`, que
  usa 3100). Si al levantar el dev server ves "Another next dev server is
  already running" con PID y puerto 4000, no es un error: apuntá el
  navegador directo a `http://localhost:4000` en vez de matar ese proceso.
  Ojo: como los env vars se cargan una sola vez al arrancar `next dev`, ese
  proceso puede quedar con keys de Supabase viejas si `.env.local` cambió
  después (pasó en la migración a real estate: seguía con las keys
  pre-rotación y toda ruta que consultaba Supabase devolvía "Tenant no
  encontrado" aunque el tenant existiera). Si ves ese síntoma con datos que
  sabes que existen, el proceso está obsoleto — ahí sí mátalo y levanta uno
  nuevo (`npm run dev` o el preview del harness) para que tome el
  `.env.local` actual.
- `xlsx` (SheetJS) tiene un advisory de seguridad conocido sin fix oficial;
  ver README para el detalle antes de ir a producción.

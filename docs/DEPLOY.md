# Despliegue: Vercel, dominio y entornos (T10)

Lo que ya está en el repo: `vercel.json` (cron semanal de correos desechables, cron diario de T17 y reset nocturno de la demo) y las variables de `.env.example`. Lo demás son pasos en tus cuentas, en este orden.

## 1. Supabase de producción (aparte del de desarrollo)
1. Crear el proyecto Pro `cotizador-prod` (el actual es de desarrollo y cambia libremente).
2. `supabase link --project-ref <ref-prod>` y `supabase db push` (aplica 0001 → 0009; si el historial no coincide, `supabase migration repair`).
3. Auth → URL Configuration: `site_url = https://ayx.solutions` y en Redirect URLs `https://ayx.solutions/**` y `https://*.ayx.solutions/**`.
4. `supabase config push` (plantillas de correo) y activar Captcha con Turnstile (ver LAUNCH-CHECKLIST §4).
5. Crear al primer admin: usuario en Auth + `insert into app_admins (user_id) values ('<id>')`.

## 2. Vercel Pro
1. Importar el repo `alandany47-tech/bta-coti`; framework Next.js, rama de producción `main`.
2. Variables (Production / Preview; Preview apunta al Supabase de desarrollo):

| Variable | Production | Preview |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase prod | Supabase desarrollo |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `ayx.solutions` | `preview.ayx.solutions` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis prod | Redis dev |
| `CRON_SECRET` | valor aleatorio largo | otro valor |
| `DEMO_PASSWORD` | la misma que uses en `DEMO_PASSWORD=... npm run seed:demo` | otro valor de prueba |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | widget prod | clave de prueba de Cloudflare |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | número de soporte | — |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | del proyecto en Sentry | mismo o vacío |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` | solo para que el build suba source maps | — |
| `HEALTH_CHECK_TOKEN` | valor aleatorio largo | otro valor |
| `HEARTBEAT_URL_DAILY`, `HEARTBEAT_URL_RESET_DEMO`, `HEARTBEAT_URL_DISPOSABLE_DOMAINS` | URL de cada heartbeat de Better Stack | — |

3. La service role nunca lleva prefijo `NEXT_PUBLIC_`.

## 2b. Cloudflare R2 (medios, T12)
1. R2 → crear el bucket (p. ej. `ayx-media`) y conectarle el dominio personalizado `media.ayx.solutions` (con proxy).
2. R2 → Manage API tokens → token S3 con permiso Object Read & Write sobre ese bucket.
3. CORS del bucket: permitir `PUT` y `GET` desde `https://*.ayx.solutions` (y `http://*.localhost:3100` en desarrollo) con el header `Content-Type`: la página compartida `slug.ayx.solutions/q/<token>` baja las imágenes con `fetch` para armar el PDF en el navegador, así que el `GET` también necesita el comodín de subdominio (no solo la raíz).
4. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y, si el dominio no es `media.<raíz>`, `NEXT_PUBLIC_MEDIA_BASE_URL`.
5. Alerta de facturación de R2 en $5 USD (ABUSE-AND-LIMITS §1).

## 2c. Sentry, salud y heartbeats (T19, docs/MONITORING.md)
1. Crear un proyecto de Next.js en [sentry.io](https://sentry.io) (plan gratis) → copiar el DSN a `SENTRY_DSN` y `NEXT_PUBLIC_SENTRY_DSN` (mismo valor; el DSN es público por diseño).
2. Settings → Auth Tokens: crear uno con scope `project:releases` → `SENTRY_AUTH_TOKEN`; el slug de la organización y del proyecto van en `SENTRY_ORG`/`SENTRY_PROJECT`. Sin esto el build sigue funcionando, solo no sube source maps.
3. `HEALTH_CHECK_TOKEN`: cualquier valor largo y aleatorio. Better Stack → Monitors → HTTP(S) con método GET, header `x-health-token: <ese valor>`, apuntando a `https://ayx.solutions/api/health/deep`.
4. Sube una vez cualquier archivo a R2 con la llave `health/ping.txt` (o la que pongas en `R2_HEALTH_KEY`): `/api/health/deep` le hace `HEAD` para confirmar que el bucket responde.
5. Better Stack → Monitors → Heartbeats: crea uno por cada cron (`daily`, `reset-demo`, `disposable-domains`) y pon sus URLs en `HEARTBEAT_URL_DAILY`, `HEARTBEAT_URL_RESET_DEMO`, `HEARTBEAT_URL_DISPOSABLE_DOMAINS`. Alerta si no llega uno en el intervalo esperado (26 h para `daily`, por ejemplo).
6. El resto de `docs/MONITORING.md` (Stripe en `/api/health/deep`, heartbeat de webhooks, alertas de negocio por correo) espera a T20/T25.

## 2d. Stripe (T20, docs/STRIPE.md)
1. Cuenta de Stripe (modo de prueba primero) → Developers → API keys → `STRIPE_SECRET_KEY` (`sk_test_...`) y `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...`).
2. `npm run stripe:sync` crea/actualiza los 4 Products y sus Prices (mensual/anual) en Stripe desde `plans` y guarda los Price IDs de vuelta en la tabla.
3. Webhook: en prueba, `stripe listen --forward-to localhost:3100/api/stripe/webhook` imprime un `whsec_...` temporal para `STRIPE_WEBHOOK_SECRET`. En vivo: Dashboard → Webhooks → endpoint con los eventos de `docs/STRIPE.md` §6 → su signing secret.
4. Dashboard → Settings → Billing → Customer portal: activar los toggles de `docs/STRIPE.md` §5 (actualizar método de pago, ver facturas, cambiar entre planes públicos, cancelar al fin del periodo; dejar apagado cambiar cantidad y pausar) — la sesión del Portal usa la configuración activa de la cuenta, no algo que fije el código.
5. Pendiente antes de dar por cerrado T20: ajustar `days_until_due` (3 días, OXXO/SPEI) contra Stripe real — Checkout no lo acepta como parámetro directo, hay que confirmar el mecanismo correcto viendo la suscripción creada de verdad; y decidir el proveedor de correo transaccional para `invoice.finalized` (ficha/CLABE) y la alerta de disputas (hoy solo quedan en `audit_log` y en el log del servidor).

## 3. Dominio (Cloudflare, DNS-only)
1. Comprar `ayx.solutions` en Cloudflare Registrar (o apuntar sus nameservers a Cloudflare).
2. En Vercel → Domains agregar `ayx.solutions` y `*.ayx.solutions` al proyecto (el comodín exige que Vercel controle `_acme-challenge`).
3. En Cloudflare DNS, sin proxy (nube gris):
   - `_acme-challenge` NS → `ns1.vercel-dns.com` y `ns2.vercel-dns.com`.
   - `@` y `*` → los valores que indique Vercel (A/CNAME).
4. Para previews con subdominios: agregar `*.preview.ayx.solutions` al proyecto y asignarlo a la rama de preview.

## 4. Verificación (criterios de T10)
- `https://cualquier.ayx.solutions` responde con SSL (un slug inexistente muestra 404 de la app, no error de certificado).
- `https://ayx.solutions/login` inicia sesión y `https://<slug>.ayx.solutions/panel` conserva la sesión (cookie `.ayx.solutions`).
- Un preview usa el Supabase de desarrollo: `NEXT_PUBLIC_SUPABASE_URL` distinto al de producción en Settings → Environment Variables.
- El cron aparece en Vercel → Settings → Cron Jobs y responde 200 al ejecutarlo a mano.

## 5. Ligar un dueño a un tenant existente (pilotos previos a 0004)
Los tenants creados antes de la membresía no tienen dueño y su panel responde 404/403 hasta ligarlos. Con el usuario ya creado en Supabase Auth:

```sql
insert into public.tenant_members (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from public.tenants t, auth.users u
where t.slug = '<slug>' and u.email = '<correo del dueño>'
on conflict do nothing;
```

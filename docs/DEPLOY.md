# Despliegue: Vercel, dominio y entornos (T10)

Lo que ya está en el repo: `vercel.json` (cron semanal de correos desechables) y las variables de `.env.example`. Lo demás son pasos en tus cuentas, en este orden.

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
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | widget prod | clave de prueba de Cloudflare |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | número de soporte | — |

3. La service role nunca lleva prefijo `NEXT_PUBLIC_`.

## 2b. Cloudflare R2 (medios, T12)
1. R2 → crear el bucket (p. ej. `ayx-media`) y conectarle el dominio personalizado `media.ayx.solutions` (con proxy).
2. R2 → Manage API tokens → token S3 con permiso Object Read & Write sobre ese bucket.
3. CORS del bucket: permitir `PUT` desde `https://*.ayx.solutions` (y `http://*.localhost:3100` en desarrollo) con el header `Content-Type`.
4. Variables: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y, si el dominio no es `media.<raíz>`, `NEXT_PUBLIC_MEDIA_BASE_URL`.
5. Alerta de facturación de R2 en $5 USD (ABUSE-AND-LIMITS §1).

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

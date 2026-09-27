# Auth, registro y vínculo usuario ↔ tenant

> No hay que dar por hecho lo que ya existe. Hoy solo `/admin` tiene login. El cotizador, el import, los medios y los clientes están abiertos (usan la service role). Todo eso se reemplaza con esto.

## 1. Principios

- **Un solo sistema de identidad:** Supabase Auth. Admins internos y clientes son `auth.users`; los distingue la tabla (`app_admins` vs `tenant_members`).
- **Un solo camino de datos:** las dos vías de alta terminan en `provision_tenant()`.
- **Cookie de sesión en `.dominio.com`:** te logueas una vez y funciona en `dominio.com` y en `slug.dominio.com`. Se configura en `@supabase/ssr` con `cookieOptions.domain`.
- **Un usuario puede pertenecer a más de un tenant**: si tiene varios, al entrar elige uno.

## 2. Vía A: autoregistro (prueba de 7 días)

```
dominio.com/registro
  1. Formulario: nombre del negocio, giro (Servicios | Catálogo | Broker → plan sugerido),
     subdominio (validación en vivo con slug_available), nombre, email, contraseña. Turnstile.
  2. supabase.auth.signUp({ email, password, options: {
       emailRedirectTo: 'https://dominio.com/auth/callback',
       data: { pending_tenant: { name, slug, plan_code } } } })
     → pantalla "Revisa tu correo".
  3. /auth/callback (Route Handler):
       exchangeCodeForSession → lee user_metadata.pending_tenant
       → rpc provision_tenant(user.id, name, slug, plan_code, 'trialing', 7, 'self_signup')
       → borra pending_tenant del metadata
       → redirect https://<slug>.dominio.com/panel/bienvenida
  4. Onboarding (3 pasos, se pueden saltar): logo y color → primeros 3 ítems (o importar Excel) → probar una cotización.
```

- **Si el slug se ocupó entre el registro y la confirmación:** el callback redirige a `/registro/subdominio` para elegir otro. Nunca falla en silencio.
- **Un email por prueba:** si ya existe como owner de un tenant en `trialing` o `canceled` por prueba vencida, no se da otra prueba (se ofrece pagar).
- **Registro con Google (opcional, F2):** el mismo callback; si no hay `pending_tenant`, se lleva a `/registro/negocio`.

## 3. Vía B: alta manual desde `/admin`

```
/admin → "Nuevo cliente"
  Campos: negocio, subdominio, email del dueño, plan, estado (trialing|active),
          días de prueba (si trialing), billing_mode (stripe|manual), notas.
  Server action (valida getAdminUser()):
    1. ¿Existe el usuario con ese email?
         sí → usar su id
         no → auth.admin.inviteUserByEmail(email, { redirectTo: 'https://dominio.com/auth/callback?next=/panel' })
    2. rpc provision_tenant(user_id, ..., source 'admin')
    3. si billing_mode = 'stripe' y status = 'active' → crear Checkout Session y mostrar/copiar el link
    4. audit_log('tenant.created_by_admin')
  El cliente recibe la invitación, define su contraseña y entra a su panel.
```

## 4. Login y recuperación

| Ruta | Qué hace |
|---|---|
| `dominio.com/login` | Email + contraseña o magic link. Tras entrar: si es admin → `/admin`; si tiene 1 tenant → `slug./panel`; si tiene varios → selector |
| `slug.dominio.com/panel/*` | Exige sesión y `is_member(tenant)`. Si no hay sesión → `dominio.com/login?next=<url>` |
| `dominio.com/recuperar` | `resetPasswordForEmail` |
| `/auth/callback` | Único callback para signup, invite, magic link y recovery |

## 5. Estados y acceso

| Estado | Storefront público | Panel del tenant | Links `/q/` |
|---|---|---|---|
| `trialing` | ✔ (con aviso discreto de "Prueba") | ✔ + banner de días restantes | ✔ |
| `active` | ✔ | ✔ | ✔ |
| `past_due` | ✔ | ✔ + banner "Actualiza tu pago" | ✔ |
| `suspended` | Página de suspendido | Solo Facturación (para pagar y reactivar) | ✖ |
| `canceled` | 404 | Solo exportar datos y reactivar | ✖ |

- **Cron diario** (T17, `/api/cron/daily` → `expire_trials()`, 0022): los tenants `trialing` con `trial_ends_at <= now()`, sin `stripe_subscription_id` y que no son demo pasan a `suspended` con `status_reason = 'trial_expired'`, con auditoría (`tenant.status_changed`, `by: cron`) e invalidación del caché. Los correos del día 5, día 7 y al vencer (Resend) son T25.
- Todo cambio de estado invalida el caché `tenant:<slug>` (`revalidateTag`).

## 6. Roles

| Rol | Puede |
|---|---|
| `owner` | Todo, incluido Facturación, usuarios y borrar el tenant |
| `editor` | Ítems, medios, clientes, cotizaciones y mensajes |
| `viewer` | Ver y crear cotizaciones; no edita catálogo ni configuración |

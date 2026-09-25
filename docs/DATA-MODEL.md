# Modelo de datos objetivo

> Se implementa en migraciones a partir de `0004_*`. Convención: `text` + `check` en lugar de enums (igual que el repo actual).

## 1. Correcciones a lo existente (migración 0004)

```sql
-- El REVOKE por columna de 0003 NO tiene efecto: anon conserva el SELECT de toda la tabla.
revoke select on public.tenants from anon;
grant select (id, name, slug, logo_url, brand_color, status, theme, modules) on public.tenants to anon;
-- (o, preferible: una vista public_tenants con esas columnas y sin grant a la tabla)
```

- Las policies de `properties` pasan a `items` (ver abajo).
- Todas las escrituras dejan la service role y pasan por RLS con la sesión del usuario.

## 2. Tablas

```sql
plans (
  id uuid pk, code text unique,          -- trial | esencial | catalogo | broker | broker_pro
  name text, price_month numeric(10,2), price_year numeric(10,2),
  stripe_price_month text, stripe_price_year text,
  modules text[],                        -- {'services','catalog','broker'}
  limits jsonb,                          -- {"items":50,"storage_bytes":524288000,"users":1,"templates":1,"quotes_month":null}
  public boolean default true, sort int
)

tenants (
  id, name, slug unique, logo_url, brand_color, created_at,         -- existentes
  plan_id uuid fk plans,
  status text check (status in ('trialing','active','past_due','suspended','canceled')),
  status_reason text,                     -- trial_expired | payment_failed | manual | ...
  trial_ends_at timestamptz,
  billing_mode text default 'stripe' check (billing_mode in ('stripe','manual')),
  source text check (source in ('self_signup','admin','demo_clone')),
  is_demo boolean default false, flagged boolean default false,   -- flagged: nombre sospechoso, revisar en admin
  theme jsonb default '{}',              -- {accent, font, cover_media_id, layout}
  settings jsonb default '{}',           -- {currency:'MXN', tax_pct:16, quote_validity_days:15, ...}
  stripe_customer_id, stripe_subscription_id, notes   -- privadas (sin grant a anon)
)

tenant_members (
  tenant_id fk, user_id fk auth.users, role text check (role in ('owner','editor','viewer')),
  created_at, primary key (tenant_id, user_id)
)

tenant_invites (                          -- invitar usuarios extra (según plans.limits.users)
  id, tenant_id, email, role, token, expires_at, accepted_at
)

subscriptions (
  tenant_id pk fk, stripe_subscription_id, stripe_price_id, status, payment_method text,  -- card | oxxo | spei | manual
  current_period_end timestamptz, cancel_at_period_end boolean, updated_at
)

usage (
  tenant_id pk fk, storage_bytes bigint default 0, items_count int default 0,
  quotes_this_month int default 0, month_key text, updated_at
)

items (                                   -- reemplaza properties (migración con copia de datos)
  id, tenant_id, kind text check (kind in ('product','service','property')),
  title, sku, description, price numeric(14,2), unit text,  -- pieza, m2, hora, servicio...
  category text, attrs jsonb default '{}',                -- property: m2_interior, m2_exterior, m2_total, parking, unit_number, floor
  status text check (status in ('available','reserved','sold','hidden')),
  sort int, cover_media_id uuid, created_at, updated_at
)

media (
  id, tenant_id, item_id null, kind text check (kind in ('image','render','plan','logo','cover')),
  r2_key text, thumb_key text, bytes bigint, width int, height int, sort int, created_at
)

clients (id, tenant_id, full_name, phone, email, notes, tags text[], created_at)   -- + notes, tags

quotes (
  id, tenant_id, client_id, created_by uuid, number int,       -- consecutivo por tenant
  module text, template_id, currency text default 'MXN',
  subtotal, discount_total, tax_total, total numeric(14,2),
  financing jsonb,                       -- broker: enganche, mensualidades, saldo, descuento
  snapshot jsonb not null,               -- cotización congelada (ítems, marca, textos)
  share_token text unique, expires_at, views int default 0, last_viewed_at,
  status text check (status in ('draft','sent','viewed','accepted','rejected','expired')),
  created_at
)

quote_items (id, quote_id, item_id null, title, qty numeric, unit_price, discount_pct, total)

templates (id, code, name, module, tier text check (tier in ('base','premium')), config jsonb, preview_url)
tenant_templates (tenant_id, template_id, source text check (source in ('plan','purchase','custom')), created_at)

message_templates (
  tenant_id, module, channel text default 'whatsapp', body text check (char_length(body) <= 1000),
  updated_at, primary key (tenant_id, module, channel)
)

catalogs (id, tenant_id, slug, title, layout jsonb, published boolean, created_at)   -- módulo Catálogo

audit_log (id, tenant_id null, actor_id, action, payload jsonb, created_at)          -- acciones del admin y cambios de estado
```

## 3. Funciones y triggers

| Nombre | Tipo | Qué hace |
|---|---|---|
| `is_member(tenant_id, min_role default 'viewer')` | SQL, security definer | Base de toda la RLS |
| `is_app_admin()` | existente | Acceso del admin |
| `provision_tenant(owner uuid, name, slug, plan_code, status, trial_days, source)` | plpgsql, security definer | Crea `tenants`, `tenant_members` (owner), `usage`, `message_templates` por defecto y `tenant_templates` del plan. Valida slug reservado y formato. Transaccional e idempotente por `owner + slug`. Ver `AUTH-ONBOARDING.md` |
| `slug_available(slug)` | SQL | Para el formulario de registro (anon, con rate limit) |
| `trg_media_usage` | trigger | Suma o resta `bytes` en `usage.storage_bytes` |
| `trg_items_usage` | trigger | Mantiene `items_count` y **bloquea el insert** si se supera `limits.items` |
| `trg_members_limit` | trigger | Bloquea miembros por encima de `limits.users` |
| `next_quote_number(tenant)` | función | Consecutivo por tenant |

## 4. RLS (patrón)

```sql
alter table x enable row level security;
create policy x_member_read  on x for select to authenticated using (is_member(tenant_id));
create policy x_editor_write on x for all    to authenticated using (is_member(tenant_id,'editor')) with check (is_member(tenant_id,'editor'));
create policy x_admin_all    on x for all    to authenticated using (is_app_admin()) with check (is_app_admin());
```

**Lectura pública (anon):**

- `items` y `media` de tenants operables con status ≠ `hidden`.
- `catalogs.published = true`.
- **Quotes:** nunca directo. `/q/<token>` se resuelve en el servidor con la función `get_shared_quote(token)` (security definer), que devuelve el snapshot y suma una vista.

**Reservados:** `www, app, admin, api, media, cdn, panel, login, registro, mail, soporte, ayuda, blog, status, docs, stripe, test, demo`. Formato: `^[a-z0-9](-?[a-z0-9]){2,29}$`.

**Antiabuso y Stripe:** tablas `blocked_terms`, `blocked_terms_allow`, `abuse_reports` y `stripe_events`, y las funciones `normalize_slug` e `is_slug_blocked`, están definidas en `ABUSE-AND-LIMITS.md` §4. Límites detallados por plan en §2 del mismo documento.

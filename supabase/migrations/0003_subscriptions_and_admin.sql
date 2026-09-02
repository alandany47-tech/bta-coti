-- BTA Cotiza — control de suscripciones + Panel de Administración Master
-- Agrega ciclo de vida de suscripción a tenants (trial -> activo -> moroso ->
-- suspendido/cancelado), la tabla app_admins para operadores internos con
-- acceso cross-tenant vía Supabase Auth, y protege las columnas sensibles
-- de tenants (notas internas, IDs de Stripe) de la lectura pública.

-- ============================================================
-- tenants: ciclo de vida de suscripción
-- ============================================================
-- Se mantiene el patrón text + check del resto del repo (products/properties/
-- quotes ya usan ese estilo) en vez de un tipo enum nativo de Postgres, para
-- no mezclar convenciones ni lidiar con ALTER TYPE ... ADD VALUE a futuro.
alter table public.tenants drop constraint if exists tenants_status_check;

-- 'inactive' (el único valor de bloqueo que existía) es semánticamente lo más
-- parecido a 'suspended' en el nuevo modelo — se remapea antes de aplicar el
-- nuevo check para no dejar filas en un estado que ya no es válido.
update public.tenants set status = 'suspended' where status = 'inactive';

alter table public.tenants alter column status set default 'trialing';

alter table public.tenants
  add constraint tenants_status_check
  check (status in ('trialing', 'active', 'past_due', 'suspended', 'canceled'));

alter table public.tenants
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column trial_ends_at timestamptz,
  add column notes text;

comment on column public.tenants.notes is
  'Notas internas del admin sobre el cliente. No exponer con la anon key (ver GRANT/REVOKE más abajo).';

-- ============================================================
-- app_admins: operadores internos con acceso cross-tenant
-- ============================================================
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Sin policies de insert/update/delete para authenticated/anon a propósito:
-- alguien ya debe ser admin (o usar la service role) para dar de alta a otro
-- admin. Evita que un admin comprometido escale escribiendo directo a esta
-- tabla desde el cliente; el alta se hace por SQL/Supabase dashboard.
alter table public.app_admins enable row level security;

create policy "app_admins_self_read" on public.app_admins
  for select
  to authenticated
  using (user_id = auth.uid());

-- Helper de RLS: security definer para no depender de que la policy de
-- app_admins_self_read alcance a cubrir la subconsulta (y para poder
-- reutilizar la misma lógica en varias tablas si hace falta a futuro).
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins where user_id = auth.uid()
  );
$$;

-- ============================================================
-- tenants: RLS — admins ven/editan todo, el resto solo lectura pública
-- de las columnas no sensibles (ver GRANT/REVOKE más abajo)
-- ============================================================
-- La policy pública original ("using (true)", sin "to") aplicaba también al
-- rol authenticated, lo que habría dejado leer notes/stripe_* (por columna)
-- a CUALQUIER usuario logueado, no solo a admins. Se re-crea acotada a anon.
drop policy if exists "tenants_public_read" on public.tenants;

create policy "tenants_public_read" on public.tenants
  for select
  to anon
  using (true);

create policy "tenants_admin_select" on public.tenants
  for select
  to authenticated
  using (public.is_app_admin());

create policy "tenants_admin_update" on public.tenants
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Columnas sensibles: fuera del alcance de la anon key. Supabase otorga
-- GRANT de tabla completa a anon/authenticated por defecto (RLS es la única
-- barrera normalmente); acá además recortamos por columna para que ni con
-- un `select *` se filtren notas internas o IDs de Stripe al front público.
-- authenticated conserva el grant completo: hoy solo lo usan los admins
-- logueados vía Supabase Auth (el cotizador público sigue usando anon).
revoke select (notes, stripe_customer_id, stripe_subscription_id)
  on public.tenants from anon;

-- ============================================================
-- properties: los tenants en trial también deben tener storefront público
-- ============================================================
-- Antes de este ticket el único estado "vivo" era 'active'. Con el modelo de
-- suscripción, un tenant en trial debe poder mostrar su cotizador (si no,
-- el self-serve no tiene forma de demostrar valor antes de cobrar).
drop policy if exists "properties_public_read_active_tenant" on public.properties;

create policy "properties_public_read_active_tenant" on public.properties
  for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = properties.tenant_id
        and t.status in ('active', 'trialing')
    )
  );

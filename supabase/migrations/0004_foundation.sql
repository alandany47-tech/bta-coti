-- T01 — Base multi-tenant segura (docs/DATA-MODEL.md, docs/AUTH-ONBOARDING.md)
-- Corrige el grant de columnas de tenants (la anon key leía notes/stripe_*),
-- agrega planes, membresías, uso, auditoría y las funciones is_member,
-- slug_available y provision_tenant.
-- Los límites en plans.limits usan null = ilimitado.

-- ============================================================
-- Slugs: formato y reservados
-- ============================================================
create or replace function public.is_slug_reserved(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_slug = any (array[
    'www','app','admin','api','media','cdn','panel','login','registro','mail',
    'soporte','ayuda','blog','status','docs','stripe','test','demo'
  ]);
$$;

create or replace function public.is_slug_valid(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_slug ~ '^[a-z0-9](-?[a-z0-9]){2,29}$', false);
$$;

-- ============================================================
-- plans
-- ============================================================
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_month numeric(10, 2) not null default 0,
  price_year numeric(10, 2) not null default 0,
  stripe_price_month text,
  stripe_price_year text,
  modules text[] not null default '{}',
  limits jsonb not null default '{}',
  public boolean not null default true,
  sort int not null default 0
);

comment on column public.plans.limits is
  'items, properties, storage_bytes, users, templates, images_per_item, plans_per_item, quotes_per_day. null = ilimitado.';
comment on table public.plans is
  'La fila trial solo guarda los topes de prueba; no se asigna a un tenant.';

insert into public.plans (code, name, price_month, price_year, modules, limits, public, sort) values
  ('trial', 'Prueba', 0, 0, '{}',
    '{"storage_bytes":209715200,"quotes_per_day":20,"images_per_item":5,"users":1}',
    false, 0),
  ('esencial', 'Esencial', 199, 1990, '{services}',
    '{"items":50,"properties":0,"storage_bytes":524288000,"users":1,"templates":1,"images_per_item":3,"plans_per_item":0,"quotes_per_day":50}',
    true, 1),
  ('catalogo', 'Catálogo', 399, 3990, '{services,catalog}',
    '{"items":300,"properties":0,"storage_bytes":2147483648,"users":2,"templates":2,"images_per_item":8,"plans_per_item":0,"quotes_per_day":100}',
    true, 2),
  ('broker', 'Broker', 699, 6990, '{broker,services}',
    '{"items":50,"properties":25,"storage_bytes":5368709120,"users":2,"templates":3,"images_per_item":20,"plans_per_item":3,"quotes_per_day":100}',
    true, 3),
  ('broker_pro', 'Broker Pro', 1199, 11990, '{services,catalog,broker}',
    '{"items":300,"properties":100,"storage_bytes":16106127360,"users":5,"templates":null,"images_per_item":30,"plans_per_item":5,"quotes_per_day":300}',
    true, 4);

-- ============================================================
-- tenants: columnas nuevas y backfill
-- ============================================================
alter table public.tenants
  add column plan_id uuid references public.plans (id),
  add column status_reason text,
  add column billing_mode text not null default 'stripe'
    check (billing_mode in ('stripe', 'manual')),
  add column source text
    check (source in ('self_signup', 'admin', 'demo_clone')),
  add column is_demo boolean not null default false,
  add column flagged boolean not null default false,
  add column theme jsonb not null default '{}',
  add column settings jsonb not null default '{}';

-- Los tenants previos a 0004 son pilotos dados de alta a mano y con cobro fuera de Stripe.
update public.tenants
set plan_id = (select id from public.plans where code = 'broker'),
    billing_mode = 'manual',
    source = 'admin'
where plan_id is null;

alter table public.tenants alter column plan_id set not null;

alter table public.tenants
  add constraint tenants_slug_format check (public.is_slug_valid(slug));

create index tenants_plan_id_idx on public.tenants (plan_id);

-- ============================================================
-- tenant_members
-- ============================================================
create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_members_user_id_idx on public.tenant_members (user_id);

-- ============================================================
-- usage
-- ============================================================
create table public.usage (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  storage_bytes bigint not null default 0,
  items_count int not null default 0,
  quotes_this_month int not null default 0,
  month_key text not null default to_char(now(), 'YYYY-MM'),
  updated_at timestamptz not null default now()
);

insert into public.usage (tenant_id, items_count)
select t.id, (select count(*) from public.properties p where p.tenant_id = t.id)
from public.tenants t;

-- ============================================================
-- audit_log
-- ============================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_id uuid,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);

-- ============================================================
-- is_member
-- ============================================================
create or replace function public.is_member(p_tenant_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_members m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and case m.role when 'owner' then 3 when 'editor' then 2 else 1 end
        >= case p_min_role when 'owner' then 3 when 'editor' then 2 else 1 end
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.plans enable row level security;
alter table public.tenant_members enable row level security;
alter table public.usage enable row level security;
alter table public.audit_log enable row level security;

create policy plans_public_read on public.plans
  for select to anon, authenticated
  using (plans.public);

create policy plans_admin_read on public.plans
  for select to authenticated
  using (public.is_app_admin());

create policy tenant_members_member_read on public.tenant_members
  for select to authenticated
  using (public.is_member(tenant_id));

create policy tenant_members_admin_read on public.tenant_members
  for select to authenticated
  using (public.is_app_admin());

create policy usage_member_read on public.usage
  for select to authenticated
  using (public.is_member(tenant_id));

create policy usage_admin_read on public.usage
  for select to authenticated
  using (public.is_app_admin());

create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using (public.is_app_admin());

create policy tenants_member_read on public.tenants
  for select to authenticated
  using (public.is_member(id));

-- ============================================================
-- Grants (allow-list): Supabase otorga ALL por defecto a anon/authenticated
-- ============================================================
revoke all on public.tenant_members, public.usage, public.audit_log from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.tenant_members, public.usage, public.audit_log from authenticated;

revoke all on public.plans from anon;
revoke insert, update, delete, truncate, references, trigger on public.plans from authenticated;
grant select on public.plans to anon;

-- El REVOKE por columna de 0003 no surtía efecto mientras existiera el grant
-- de tabla completo. Se quita el de tabla y se otorgan solo columnas públicas.
-- Las columnas nuevas de tenants quedan sin acceso hasta que se agreguen aquí.
revoke select on public.tenants from anon, authenticated;
grant select (id, name, slug, logo_url, brand_color, status, trial_ends_at, theme, created_at)
  on public.tenants to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger on public.tenants from anon;
revoke insert, delete, truncate, references, trigger on public.tenants from authenticated;

-- ============================================================
-- slug_available
-- ============================================================
create or replace function public.slug_available(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_slug_valid(p_slug)
    and not public.is_slug_reserved(p_slug)
    and not exists (select 1 from public.tenants t where t.slug = p_slug);
$$;

revoke execute on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated, service_role;

-- ============================================================
-- provision_tenant
-- ============================================================
create or replace function public.provision_tenant(
  p_owner uuid,
  p_name text,
  p_slug text,
  p_plan_code text,
  p_status text,
  p_trial_days int,
  p_source text,
  p_billing_mode text default 'stripe'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_tenant_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if p_owner is null or v_name = '' then
    raise exception 'invalid_params' using errcode = '22023';
  end if;
  if p_status not in ('trialing', 'active') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status = 'trialing' and coalesce(p_trial_days, 0) <= 0 then
    raise exception 'invalid_trial_days' using errcode = '22023';
  end if;
  if p_source not in ('self_signup', 'admin', 'demo_clone') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;
  if p_billing_mode not in ('stripe', 'manual') then
    raise exception 'invalid_billing_mode' using errcode = '22023';
  end if;
  if not public.is_slug_valid(p_slug) or public.is_slug_reserved(p_slug) then
    raise exception 'slug_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('provision_tenant:' || p_slug));

  select t.id into v_tenant_id from public.tenants t where t.slug = p_slug;
  if v_tenant_id is not null then
    if exists (
      select 1 from public.tenant_members m
      where m.tenant_id = v_tenant_id and m.user_id = p_owner and m.role = 'owner'
    ) then
      return v_tenant_id;
    end if;
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_owner) then
    raise exception 'invalid_owner' using errcode = '23503';
  end if;

  select id into v_plan_id from public.plans where code = p_plan_code and code <> 'trial';
  if v_plan_id is null then
    raise exception 'plan_not_found' using errcode = '22023';
  end if;

  insert into public.tenants (name, slug, plan_id, status, trial_ends_at, billing_mode, source)
  values (
    v_name, p_slug, v_plan_id, p_status,
    case when p_status = 'trialing' then now() + make_interval(days => p_trial_days) end,
    p_billing_mode, p_source
  )
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_tenant_id, p_owner, 'owner');

  insert into public.usage (tenant_id) values (v_tenant_id);

  return v_tenant_id;
end;
$$;

revoke execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  to service_role;

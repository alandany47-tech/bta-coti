-- T20: Stripe (docs/STRIPE.md).
-- 1) `stripe_events` para idempotencia de webhooks (§6): el webhook inserta el id del evento antes
--    de procesarlo; si ya existe, responde 200 sin repetir nada.
-- 2) `subscriptions` para lo que sincroniza `customer.subscription.created/updated` (plan, periodo,
--    `cancel_at_period_end`) — T21 lo lee en Panel → Facturación.
-- 3) `status_changed_at` en tenants: Stripe no manda un webhook "lleva 7 días en past_due"
--    (no existe `invoice.overdue`); el cron diario lo deriva de este campo.
-- 4) `plan_usage_overages`: qué límites del plan nuevo ya se rebasarían con el uso actual, para
--    bloquear un downgrade desde nuestro propio flujo de Checkout con un mensaje claro.
-- 5) `plan_id` de tenants seguía sin estar en el grant de columnas de 0004: ni el panel del propio
--    tenant podía leer su plan actual con el cliente de sesión.

alter table public.tenants add column status_changed_at timestamptz not null default now();

grant select (plan_id, stripe_customer_id) on public.tenants to authenticated;

create or replace function public.set_tenant_status(
  p_tenant uuid,
  p_status text,
  p_reason text,
  p_actor uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_prev text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_status is null or p_status not in ('active', 'past_due', 'suspended', 'canceled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status in ('suspended', 'canceled') and v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select t.slug, t.status into v_slug, v_prev
  from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'tenant_not_found' using errcode = 'P0002';
  end if;

  update public.tenants
  set status = p_status,
      status_reason = v_reason,
      status_changed_at = case when p_status <> v_prev then now() else status_changed_at end
  where id = p_tenant;

  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (p_tenant, p_actor, 'tenant.status_changed',
          jsonb_build_object('from', v_prev, 'to', p_status, 'reason', v_reason));

  return v_slug;
end;
$$;

-- ============================================================
-- stripe_events (idempotencia de webhooks)
-- ============================================================
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ============================================================
-- subscriptions (una por tenant; la lee T21 en Panel → Facturación)
-- ============================================================
create table public.subscriptions (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  status text not null,
  collection_method text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy subscriptions_member_read on public.subscriptions
  for select to authenticated
  using (public.is_member(tenant_id));

create policy subscriptions_admin_read on public.subscriptions
  for select to authenticated
  using (public.is_app_admin());

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- ============================================================
-- plan_usage_overages: para bloquear un downgrade que ya rebasaría el plan nuevo (docs/STRIPE.md §4).
-- La llama `app/api/[tenant]/billing/checkout` con el cliente de sesión (nunca service role ahí,
-- CLAUDE.md), así que valida membresía ella misma antes de exponer el uso del tenant.
-- ============================================================
create or replace function public.plan_usage_overages(p_tenant uuid, p_plan_code text)
returns table (key text, used bigint, allowed bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_limits jsonb;
begin
  if auth.role() <> 'service_role' and not public.is_member(p_tenant) then
    return;
  end if;

  select limits into v_limits from public.plans where code = p_plan_code;
  if v_limits is null then
    return;
  end if;

  if v_limits ? 'items' then
    return query
      select 'items'::text, count(*), (v_limits ->> 'items')::bigint
      from public.items i where i.tenant_id = p_tenant and i.kind <> 'property'
      having count(*) > (v_limits ->> 'items')::bigint;
  end if;

  if v_limits ? 'properties' then
    return query
      select 'properties'::text, count(*), (v_limits ->> 'properties')::bigint
      from public.items i where i.tenant_id = p_tenant and i.kind = 'property'
      having count(*) > (v_limits ->> 'properties')::bigint;
  end if;

  if v_limits ? 'storage_bytes' then
    return query
      select 'storage_bytes'::text, u.storage_bytes, (v_limits ->> 'storage_bytes')::bigint
      from public.usage u
      where u.tenant_id = p_tenant and u.storage_bytes > (v_limits ->> 'storage_bytes')::bigint;
  end if;

  if v_limits ? 'users' then
    return query
      select 'users'::text, count(*), (v_limits ->> 'users')::bigint
      from public.tenant_members m where m.tenant_id = p_tenant
      having count(*) > (v_limits ->> 'users')::bigint;
  end if;
end;
$$;

revoke execute on function public.plan_usage_overages(uuid, text) from public, anon;
grant execute on function public.plan_usage_overages(uuid, text) to authenticated, service_role;

-- ============================================================
-- expire_past_due: Stripe no manda un evento cuando una cuenta lleva mucho en past_due; se deriva
-- de status_changed_at. Se llama desde el cron diario junto con expire_trials().
-- ============================================================
create or replace function public.expire_past_due()
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant record;
begin
  for v_tenant in
    select id from public.tenants
    where status = 'past_due'
      and status_changed_at < now() - interval '7 days'
    order by id
    for update skip locked
  loop
    return next public.set_tenant_status(v_tenant.id, 'suspended', 'payment_failed', null);
  end loop;
  return;
end;
$$;

revoke execute on function public.expire_past_due() from public, anon, authenticated;
grant execute on function public.expire_past_due() to service_role;

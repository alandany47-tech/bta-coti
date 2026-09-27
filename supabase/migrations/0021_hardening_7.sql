-- Endurecimiento tras la revisión de Codex a T26 (diff completo contra main).
-- 1) `get_quote_tenant_slug` quedó STABLE y llama `check_rpc_rate_limit`, que hace un INSERT:
--    PostgREST corre las funciones STABLE en una transacción de solo lectura, así que la RPC
--    fallaba con "cannot execute INSERT in a read-only transaction" y `app/q/[token]` daba 404 a
--    todo enlace válido. Pasa a VOLATILE (el default).
-- 2) El límite por IP de 0019 usa `x-forwarded-for`; cuando llama el servidor de Next.js esa IP es
--    la de salida de Vercel, así que todos los visitantes compartían el cupo (20/min de slug,
--    120/min de cotizaciones). Las llamadas con service role (solo el servidor la tiene) se dan por
--    confiables: el límite por visitante ya lo puso Upstash antes (lib/public-rpc.ts). Quien llame
--    directo por REST con la anon key sigue topado por IP.
-- 3) La demo es compartida: su editor no puede quitar fotos ni el plano de un ítem (la ruta ya lo
--    frena; esto cubre a quien use la sesión directo por REST). Reordenar sí se permite.
-- 4) "Clonar demo como prospecto" en una sola transacción: si copiar el catálogo falla, tampoco
--    queda el tenant (antes quedaba vacío y con el slug ocupado).

-- ============================================================
-- 2) Helper: ¿aplica el límite por IP a esta llamada?
-- ============================================================
create or replace function public.rpc_limit_ok(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;
  return public.check_rpc_rate_limit(p_bucket, public.request_ip(), p_limit, p_window_seconds);
end;
$$;

revoke execute on function public.rpc_limit_ok(text, int, int) from public, anon, authenticated;

create or replace function public.slug_available(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.rpc_limit_ok('slug_available_min', 20, 60) then
    return false;
  end if;
  if not public.rpc_limit_ok('slug_available_day', 200, 86400) then
    return false;
  end if;
  return public.is_slug_valid(p_slug)
    and not public.is_slug_blocked(p_slug)
    and not exists (select 1 from public.tenants t where t.slug = p_slug);
end;
$$;

create or replace function public.get_shared_quote(p_token text)
returns table (
  snapshot jsonb, number int, status text, expires_at timestamptz, expired boolean, views int,
  tenant_slug text, tenant_name text, tenant_logo_url text, brand_color text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quotes;
  v_slug text;
  v_name text;
  v_logo text;
  v_color text;
begin
  if p_token is null or length(p_token) < 32 then
    return;
  end if;
  if not public.rpc_limit_ok('shared_quote_min', 120, 60) then
    return;
  end if;

  select q.* into v_row
  from public.quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.share_token = p_token and t.status in ('active', 'trialing', 'past_due')
  for update of q;
  if not found then
    return;
  end if;

  select t.slug, t.name, t.logo_url, t.brand_color into v_slug, v_name, v_logo, v_color
  from public.tenants t where t.id = v_row.tenant_id;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return query select null::jsonb, v_row.number, 'expired'::text, v_row.expires_at, true, v_row.views,
      v_slug, v_name, v_logo, v_color;
    return;
  end if;

  update public.quotes q
  set views = q.views + 1,
      last_viewed_at = now(),
      status = case when q.status = 'sent' then 'viewed' else q.status end
  where q.id = v_row.id
  returning q.views, q.status into v_row.views, v_row.status;

  return query select v_row.snapshot, v_row.number, v_row.status, v_row.expires_at, false, v_row.views,
    v_slug, v_name, v_logo, v_color;
end;
$$;

-- ============================================================
-- 1) get_quote_tenant_slug: VOLATILE (escribe en rpc_rate_limit)
-- ============================================================
create or replace function public.get_quote_tenant_slug(p_token text)
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 32 or not public.rpc_limit_ok('shared_quote_min', 120, 60) then
    return null;
  end if;
  return (
    select t.slug
    from public.quotes q
    join public.tenants t on t.id = q.tenant_id
    where q.share_token = p_token and t.status in ('active', 'trialing', 'past_due')
  );
end;
$$;

-- ============================================================
-- 3) La demo no pierde fotos ni planos por un usuario con sesión
-- ============================================================
create or replace function public.items_demo_media_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new; -- servidor (service role), reset de la demo o migraciones
  end if;
  if not exists (select 1 from public.tenants t where t.id = new.tenant_id and t.is_demo) then
    return new;
  end if;
  if exists (select 1 from unnest(old.images) u where not u = any (coalesce(new.images, '{}')))
     or (old.floor_plan_url is not null and new.floor_plan_url is distinct from old.floor_plan_url) then
    raise exception 'demo_media_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists items_demo_media_guard on public.items;
create trigger items_demo_media_guard
  before update of images, floor_plan_url on public.items
  for each row execute function public.items_demo_media_guard();

-- ============================================================
-- 4) Clonar demo como prospecto, atómico
-- ============================================================
create or replace function public.clone_demo_tenant(
  p_source uuid,
  p_owner uuid,
  p_name text,
  p_slug text,
  p_trial_days int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_tenant uuid;
begin
  select p.code into v_plan
  from public.tenants t join public.plans p on p.id = t.plan_id
  where t.id = p_source and t.is_demo;
  if v_plan is null then
    raise exception 'source_not_demo' using errcode = '22023';
  end if;

  v_tenant := public.provision_tenant(p_owner, p_name, p_slug, v_plan, 'trialing', p_trial_days, 'demo_clone', 'manual');
  perform public.clone_demo_items(p_source, v_tenant);
  return v_tenant;
end;
$$;

revoke execute on function public.clone_demo_tenant(uuid, uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.clone_demo_tenant(uuid, uuid, text, text, int) to service_role;

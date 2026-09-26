-- T12 — Medios en Cloudflare R2: tabla media, cuota por plan verificada en BD y triggers de usage.
-- Las escrituras las hace solo la service role, a través de estas funciones, después de que el
-- servidor verifica sesión, rol y el tamaño real del objeto en R2 (HEAD).

-- ============================================================
-- media
-- ============================================================
create table public.media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  item_id uuid,
  kind text not null check (kind in ('image', 'render', 'plan', 'logo', 'cover')),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  r2_key text not null unique,
  thumb_key text,
  content_type text not null,
  bytes bigint not null check (bytes >= 0),
  thumb_bytes bigint not null default 0 check (thumb_bytes >= 0),
  width int,
  height int,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.media.item_id is 'properties.id hoy; items.id cuando T14 migre.';
comment on column public.media.bytes is 'Declarado mientras está pending; tamaño real (HEAD en R2) cuando queda ready.';

create index media_tenant_item_idx on public.media (tenant_id, item_id);
create index media_pending_idx on public.media (created_at) where status = 'pending';

alter table public.media enable row level security;

create policy media_public_read on public.media
  for select to anon, authenticated
  using (
    status = 'ready'
    and exists (
      select 1 from public.tenants t
      where t.id = media.tenant_id and t.status in ('active', 'trialing', 'past_due')
    )
  );

create policy media_admin_read on public.media
  for select to authenticated
  using (public.is_app_admin());

revoke all on public.media from anon, authenticated;
grant select on public.media to anon, authenticated;

-- ============================================================
-- usage.storage_bytes lo mantiene un trigger (solo cuentan los medios ready)
-- ============================================================
create or replace function public.media_usage_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(new.tenant_id, old.tenant_id);
  v_old bigint := case when tg_op in ('UPDATE', 'DELETE') and old.status = 'ready' then old.bytes + old.thumb_bytes else 0 end;
  v_new bigint := case when tg_op in ('INSERT', 'UPDATE') and new.status = 'ready' then new.bytes + new.thumb_bytes else 0 end;
begin
  if v_new <> v_old then
    insert into public.usage (tenant_id, storage_bytes) values (v_tenant, greatest(v_new - v_old, 0))
    on conflict (tenant_id) do update
      set storage_bytes = greatest(public.usage.storage_bytes + (v_new - v_old), 0), updated_at = now();
  end if;
  return null;
end;
$$;

revoke execute on function public.media_usage_sync() from public, anon, authenticated;

create trigger trg_media_usage
  after insert or update or delete on public.media
  for each row execute function public.media_usage_sync();

-- ============================================================
-- Límite efectivo: el del plan, acotado por los topes de prueba mientras está en trialing
-- ============================================================
create or replace function public.effective_limit(p_tenant uuid, p_key text)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  with t as (
    select t.status, p.limits as plan_limits
    from public.tenants t join public.plans p on p.id = t.plan_id
    where t.id = p_tenant
  ),
  trial as (select limits from public.plans where code = 'trial')
  select case
    when t.status = 'trialing' and (select limits ? p_key from trial) then
      case
        when t.plan_limits ->> p_key is null then (select (limits ->> p_key)::bigint from trial)
        else least((t.plan_limits ->> p_key)::bigint, (select (limits ->> p_key)::bigint from trial))
      end
    else (t.plan_limits ->> p_key)::bigint
  end
  from t;
$$;

revoke execute on function public.effective_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.effective_limit(uuid, text) to service_role;

-- ============================================================
-- reserve_media: valida cuota y crea la fila pending con las llaves de R2
-- ============================================================
create or replace function public.reserve_media(
  p_tenant uuid,
  p_item uuid,
  p_kind text,
  p_content_type text,
  p_bytes bigint,
  p_thumb_bytes bigint,
  p_width int,
  p_height int
)
returns table (id uuid, r2_key text, thumb_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_status text;
  v_used bigint;
  v_pending bigint;
  v_limit bigint;
  v_count int;
  v_ext text := case when p_content_type = 'application/pdf' then 'pdf' else 'webp' end;
  v_base text;
  v_thumb text;
begin
  if p_kind not in ('image', 'render', 'plan', 'logo', 'cover') or p_bytes is null or p_bytes <= 0
     or coalesce(p_thumb_bytes, 0) < 0 then
    raise exception 'invalid_params' using errcode = '22023';
  end if;

  select t.status into v_status from public.tenants t where t.id = p_tenant;
  if v_status is null or v_status not in ('active', 'trialing', 'past_due') then
    raise exception 'tenant_not_operable' using errcode = '22023';
  end if;

  insert into public.usage (tenant_id) values (p_tenant) on conflict (tenant_id) do nothing;
  select u.storage_bytes into v_used from public.usage u where u.tenant_id = p_tenant for update;

  delete from public.media m
  where m.tenant_id = p_tenant and m.status = 'pending' and m.created_at < now() - interval '15 minutes';

  select coalesce(sum(m.bytes + m.thumb_bytes), 0) into v_pending
  from public.media m where m.tenant_id = p_tenant and m.status = 'pending';

  v_limit := public.effective_limit(p_tenant, 'storage_bytes');
  if v_limit is not null and v_used + v_pending + p_bytes + coalesce(p_thumb_bytes, 0) > v_limit then
    raise exception 'storage_quota_exceeded' using errcode = 'P0001';
  end if;

  if p_item is not null and p_kind in ('image', 'render', 'plan') then
    v_limit := public.effective_limit(p_tenant, case when p_kind = 'plan' then 'plans_per_item' else 'images_per_item' end);
    if v_limit is not null then
      select count(*) into v_count from public.media m
      where m.tenant_id = p_tenant and m.item_id = p_item
        and (m.kind = 'plan') = (p_kind = 'plan');
      if v_count >= v_limit then
        raise exception 'item_media_limit' using errcode = 'P0001';
      end if;
    end if;
  end if;

  v_base := 't/' || p_tenant::text || '/' || coalesce(p_item::text, '_') || '/' || v_id::text;
  v_thumb := case when coalesce(p_thumb_bytes, 0) > 0 then v_base || '-thumb.webp' end;

  return query
  insert into public.media as m (id, tenant_id, item_id, kind, r2_key, thumb_key, content_type, bytes, thumb_bytes, width, height)
  values (v_id, p_tenant, p_item, p_kind, v_base || '-full.' || v_ext, v_thumb, p_content_type,
          p_bytes, coalesce(p_thumb_bytes, 0), p_width, p_height)
  returning m.id, m.r2_key, m.thumb_key;
end;
$$;

-- ============================================================
-- confirm_media: fija los tamaños reales y la deja ready (cuenta en usage vía trigger)
-- ============================================================
create or replace function public.confirm_media(p_id uuid, p_tenant uuid, p_bytes bigint, p_thumb_bytes bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media;
  v_used bigint;
  v_pending bigint;
  v_limit bigint;
begin
  select * into v_row from public.media m where m.id = p_id and m.tenant_id = p_tenant for update;
  if not found then
    raise exception 'media_not_found' using errcode = 'P0002';
  end if;
  if v_row.status = 'ready' then
    return;
  end if;
  if p_bytes is null or p_bytes <= 0 or coalesce(p_thumb_bytes, 0) < 0 then
    raise exception 'invalid_params' using errcode = '22023';
  end if;

  select u.storage_bytes into v_used from public.usage u where u.tenant_id = p_tenant for update;
  select coalesce(sum(m.bytes + m.thumb_bytes), 0) into v_pending
  from public.media m where m.tenant_id = p_tenant and m.status = 'pending' and m.id <> p_id;

  v_limit := public.effective_limit(p_tenant, 'storage_bytes');
  if v_limit is not null and coalesce(v_used, 0) + v_pending + p_bytes + coalesce(p_thumb_bytes, 0) > v_limit then
    raise exception 'storage_quota_exceeded' using errcode = 'P0001';
  end if;

  update public.media
  set status = 'ready', bytes = p_bytes, thumb_bytes = coalesce(p_thumb_bytes, 0)
  where id = p_id;
end;
$$;

-- ============================================================
-- delete_media: borra la fila (el trigger descuenta) y devuelve las llaves para borrar en R2
-- ============================================================
create or replace function public.delete_media(p_id uuid, p_tenant uuid)
returns table (r2_key text, thumb_key text)
language sql
security definer
set search_path = public
as $$
  delete from public.media m
  where m.id = p_id and m.tenant_id = p_tenant
  returning m.r2_key, m.thumb_key;
$$;

revoke execute on function public.reserve_media(uuid, uuid, text, text, bigint, bigint, int, int) from public, anon, authenticated;
revoke execute on function public.confirm_media(uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke execute on function public.delete_media(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_media(uuid, uuid, text, text, bigint, bigint, int, int) to service_role;
grant execute on function public.confirm_media(uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.delete_media(uuid, uuid) to service_role;

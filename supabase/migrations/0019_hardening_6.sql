-- Endurecimiento tras la revisión de Codex a T15/T16.
-- 1) El tope de propiedades/ítems por kind (0015) solo corría en el INSERT: un editor podía crear
--    un servicio y luego convertirlo a propiedad (o el import podía "reconvertir" un ítem existente
--    por su sku) sin pasar por la validación. Ahora también corre en el UPDATE cuando cambia la
--    categoría (propiedad ↔ no propiedad).
-- 2) `slug_available` y `get_shared_quote`/`get_quote_tenant_slug` son RPC con `security definer`
--    otorgadas a `anon`: cualquiera con la anon key (pública) puede llamarlas directo por REST,
--    saltándose el rate limit de Upstash que solo protege las rutas de Next.js. Un límite adicional
--    a nivel de base (por IP) cierra ese hueco para quien no pasa por la app.
-- 3) Borrar un medio ya no puede tocar el R2 de una cotización enviada y vigente: el PDF/página
--    compartida seguiría enseñando la URL. Se bloquea mientras exista una cotización sin vencer
--    cuyo snapshot referencie esa llave.

-- ============================================================
-- 1) items_quota_guard también en UPDATE
-- ============================================================
create or replace function public.items_quota_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_count bigint;
begin
  if tg_op = 'UPDATE' and (old.kind = 'property') = (new.kind = 'property') then
    return new; -- no cambia la categoría (propiedad vs. no propiedad): nada que validar
  end if;

  perform 1 from public.usage u where u.tenant_id = new.tenant_id for update;

  if tg_op = 'INSERT' and new.sku is not null and exists (
    select 1 from public.items i where i.tenant_id = new.tenant_id and i.sku = new.sku
  ) then
    return new; -- upsert sobre un sku existente: la fila real la valida el UPDATE, no este INSERT
  end if;

  v_limit := public.effective_limit(new.tenant_id, case when new.kind = 'property' then 'properties' else 'items' end);
  if v_limit is not null then
    select count(*) into v_count from public.items i
    where i.tenant_id = new.tenant_id
      and i.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (i.kind = 'property') = (new.kind = 'property');
    if v_count >= v_limit then
      raise exception 'item_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists items_quota_guard on public.items;
create trigger items_quota_guard
  before insert or update on public.items
  for each row execute function public.items_quota_guard();

-- ============================================================
-- 2) Límite por IP dentro de la base para las RPC públicas
-- ============================================================
create table public.rpc_rate_limit (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (bucket, key, window_start)
);

revoke all on public.rpc_rate_limit from public, anon, authenticated;

create or replace function public.request_ip()
returns text
language plpgsql
stable
as $$
declare
  v_xff text;
begin
  v_xff := nullif(btrim(current_setting('request.headers', true)::json ->> 'x-forwarded-for'), '');
  if v_xff is null then
    return 'unknown';
  end if;
  return btrim(split_part(v_xff, ',', 1));
exception when others then
  return 'unknown';
end;
$$;

/**
 * Ventana fija por (bucket, key, tramo de p_window_seconds). No es tan preciso como el sliding
 * window de Upstash (lib/rate-limit.ts), pero alcanza como respaldo para quien llame las RPC
 * directo por REST sin pasar por la app. Limpia oportunistamente filas de más de 2 días.
 */
create or replace function public.check_rpc_rate_limit(p_bucket text, p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  if random() < 0.01 then
    delete from public.rpc_rate_limit where window_start < now() - interval '2 days';
  end if;

  insert into public.rpc_rate_limit (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window_start, 1)
  on conflict (bucket, key, window_start) do update set hits = public.rpc_rate_limit.hits + 1
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke execute on function public.request_ip() from public, anon, authenticated;
revoke execute on function public.check_rpc_rate_limit(text, text, int, int) from public, anon, authenticated;

create or replace function public.slug_available(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.check_rpc_rate_limit('slug_available_min', public.request_ip(), 20, 60) then
    return false;
  end if;
  if not public.check_rpc_rate_limit('slug_available_day', public.request_ip(), 200, 86400) then
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
  if not public.check_rpc_rate_limit('shared_quote_min', public.request_ip(), 120, 60) then
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

create or replace function public.get_quote_tenant_slug(p_token text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 32 or not public.check_rpc_rate_limit('shared_quote_min', public.request_ip(), 120, 60) then
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
-- 3) delete_media no borra un medio referenciado por una cotización vigente
-- ============================================================
create or replace function public.delete_media(p_id uuid, p_tenant uuid)
returns table (r2_key text, thumb_key text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.media;
begin
  select * into v_row from public.media m where m.id = p_id and m.tenant_id = p_tenant;
  if not found then
    return;
  end if;

  if exists (
    select 1 from public.quotes q
    where q.tenant_id = p_tenant
      and (q.expires_at is null or q.expires_at > now())
      and position(v_row.r2_key in q.snapshot::text) > 0
  ) then
    raise exception 'media_in_use' using errcode = 'P0001';
  end if;

  delete from public.media m where m.id = p_id and m.tenant_id = p_tenant;
  return query select v_row.r2_key, v_row.thumb_key;
end;
$$;

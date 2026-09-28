-- Tercera ronda de Codex sobre la pila completa.
-- 1) 0023 revirtió `p_ip` (0021 dejaba que quien llama elija su propia llave de límite), pero
--    volver a `request_ip()` para todos hizo que la app, que llama estas RPC con la anon key desde
--    su propio servidor, comparta la IP de salida de Vercel entre TODOS sus visitantes: con
--    tráfico moderado, el cupo compartido se agota y usuarios legítimos ven "slug no disponible" o
--    cotizaciones 404 aunque Upstash (que sí ve la IP real de cada uno) los deje pasar sin problema.
--    La solución de fondo: el límite de la base es solo el respaldo para quien se salta la app por
--    completo — la app misma ya tiene su propio límite correcto (Upstash + IP real). Estas RPC ahora
--    se saltan el respaldo cuando `auth.role() = 'service_role'` (la llave de servicio, que solo el
--    servidor tiene — nunca llega al navegador ni a un llamador anónimo). La app pasa a llamarlas
--    con `createServiceRoleClient()` en vez de la anon key; un llamador directo por REST con la
--    anon key sigue viendo el límite de siempre.
-- 2) Un medio "en uso" (media_in_use) que se desprende de un ítem se quedaba sin fila que lo borre
--    nunca: el cron de huérfanos (T17) protege cualquier fila con `media`, así que ese objeto sigue
--    contando en la cuota del tenant para siempre incluso después de que la cotización que lo
--    bloqueaba venza. `detached_at` marca el momento en que se desprendió; el cron diario reintenta
--    borrarlo cada día hasta que la cotización venza y el borrado por fin pase.

create or replace function public.slug_available(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if not public.check_rpc_rate_limit('slug_available_min', public.request_ip(), 20, 60) then
      return false;
    end if;
    if not public.check_rpc_rate_limit('slug_available_day', public.request_ip(), 200, 86400) then
      return false;
    end if;
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
  if auth.role() <> 'service_role' and not public.check_rpc_rate_limit('shared_quote_min', public.request_ip(), 120, 60) then
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
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;
  if auth.role() <> 'service_role' and not public.check_rpc_rate_limit('shared_quote_min', public.request_ip(), 120, 60) then
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
-- 2) Medios desprendidos que quedaron bloqueados (media_in_use): reintento diario
-- ============================================================
alter table public.media add column detached_at timestamptz;

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

/**
 * Marca un medio como desprendido de su ítem cuando `delete_media` no pudo borrarlo por
 * `media_in_use`: una función que revienta con `raise exception` deshace también los `update` que
 * hizo antes de reventar (es la misma transacción), así que esto tiene que ser una llamada aparte,
 * después de que el caller atrapa el error (app/api/[tenant]/properties/[propertyId]/images/route.ts).
 */
create or replace function public.mark_media_detached(p_id uuid, p_tenant uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.media set detached_at = coalesce(detached_at, now())
  where id = p_id and tenant_id = p_tenant;
$$;

revoke execute on function public.mark_media_detached(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_media_detached(uuid, uuid) to service_role;

/** La llama el cron diario (T17): reintenta borrar cada medio desprendido; el que siga bloqueado por
  * media_in_use se queda para la próxima corrida. Devuelve cuántos se lograron borrar de verdad. */
create or replace function public.retry_detached_media_deletes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in select id, tenant_id from public.media where detached_at is not null loop
    begin
      perform public.delete_media(v_row.id, v_row.tenant_id);
      v_count := v_count + 1;
    exception when others then
      null; -- sigue bloqueada u otro error puntual: se reintenta la próxima corrida
    end;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.retry_detached_media_deletes() from public, anon, authenticated;
grant execute on function public.retry_detached_media_deletes() to service_role;

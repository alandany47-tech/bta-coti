-- Segunda revisión de Codex sobre la pila completa (después de 0021/0022).
-- 1) `p_ip` (0021) resultó peor que el problema que arreglaba: como estas RPC las ejecuta `anon`,
--    cualquiera que las llame directo por REST controla `p_ip` y puede (a) rotarlo en cada llamada
--    para saltarse el límite por completo, o (b) mandar la IP real de otra persona para agotarle
--    su cupo a ella. El problema original que 0021 quería resolver (que la app comparte la IP de
--    salida de Vercel entre todos los visitantes) ya lo resuelve bien Upstash del lado de la app
--    (`lib/rate-limit.ts`, con la IP real del visitante); este límite en la base es solo el
--    respaldo para quien se salta la app por completo, y para ese caso la única llave de la que
--    se puede desconfiar menos es la que ve la propia conexión (`request_ip()`), nunca un parámetro
--    que pone quien llama. Se revierte `p_ip` por completo.
-- 2) `get_quote_tenant_slug` sigue sin `stable` (0021 ya lo corrigió; se mantiene igual aquí).

drop function if exists public.slug_available(text, text);
drop function if exists public.get_shared_quote(text, text);
drop function if exists public.get_quote_tenant_slug(text, text);

create function public.slug_available(p_slug text)
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

revoke execute on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated, service_role;

create function public.get_shared_quote(p_token text)
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

revoke execute on function public.get_shared_quote(text) from public;
grant execute on function public.get_shared_quote(text) to anon, authenticated, service_role;

create function public.get_quote_tenant_slug(p_token text)
returns text
language plpgsql
security definer
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

revoke execute on function public.get_quote_tenant_slug(text) from public;
grant execute on function public.get_quote_tenant_slug(text) to anon, authenticated, service_role;

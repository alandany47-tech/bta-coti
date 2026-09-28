-- Segunda ronda de endurecimiento (revisión de Codex a la pila T15/T16/T26 completa).
-- 1) `get_quote_tenant_slug` seguía marcada `stable` después de que 0019 le agregó una llamada a
--    `check_rpc_rate_limit` (hace INSERT). PostgREST corre las RPC `stable`/`immutable` en una
--    transacción de solo lectura, así que cada visita por el dominio raíz fallaba con "cannot
--    execute INSERT in a read-only transaction" y el redirect a `slug.dominio/q/<token>` devolvía
--    404 aunque el token fuera válido.
-- 2) `slug_available`, `get_shared_quote` y `get_quote_tenant_slug` leen `request_ip()` (el
--    `x-forwarded-for` que ve Postgres) para el límite por IP de 0019. Pero la app las llama desde
--    el servidor de Next.js (`createServerSupabaseClient`), no desde el navegador: Supabase ve la
--    IP de salida de Vercel, compartida por todos los visitantes, así que ese límite termina
--    agrupando a usuarios distintos en un solo cubo. Se agrega `p_ip` (opcional): si la app lo manda
--    con la IP real del visitante (misma que ya usa `lib/rate-limit.ts`), se usa esa; si no llega
--    (alguien llamando la RPC directo por REST), se cae de vuelta a `request_ip()` como antes.

drop function if exists public.slug_available(text);
drop function if exists public.get_shared_quote(text);
drop function if exists public.get_quote_tenant_slug(text);

create function public.slug_available(p_slug text, p_ip text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := coalesce(nullif(btrim(p_ip), ''), public.request_ip());
begin
  if not public.check_rpc_rate_limit('slug_available_min', v_key, 20, 60) then
    return false;
  end if;
  if not public.check_rpc_rate_limit('slug_available_day', v_key, 200, 86400) then
    return false;
  end if;
  return public.is_slug_valid(p_slug)
    and not public.is_slug_blocked(p_slug)
    and not exists (select 1 from public.tenants t where t.slug = p_slug);
end;
$$;

revoke execute on function public.slug_available(text, text) from public;
grant execute on function public.slug_available(text, text) to anon, authenticated, service_role;

create function public.get_shared_quote(p_token text, p_ip text default null)
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
  v_key text := coalesce(nullif(btrim(p_ip), ''), public.request_ip());
begin
  if p_token is null or length(p_token) < 32 then
    return;
  end if;
  if not public.check_rpc_rate_limit('shared_quote_min', v_key, 120, 60) then
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

revoke execute on function public.get_shared_quote(text, text) from public;
grant execute on function public.get_shared_quote(text, text) to anon, authenticated, service_role;

create function public.get_quote_tenant_slug(p_token text, p_ip text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := coalesce(nullif(btrim(p_ip), ''), public.request_ip());
begin
  if p_token is null or length(p_token) < 32 or not public.check_rpc_rate_limit('shared_quote_min', v_key, 120, 60) then
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

revoke execute on function public.get_quote_tenant_slug(text, text) from public;
grant execute on function public.get_quote_tenant_slug(text, text) to anon, authenticated, service_role;

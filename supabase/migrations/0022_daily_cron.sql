-- T17 — Cron diario (`/api/cron/daily`): vence pruebas, limpia huérfanos de R2 y reinicia el
-- contador mensual de cotizaciones. Todo idempotente: correrlo dos veces el mismo día no cambia
-- nada la segunda vez. Solo la service role (el cron) ejecuta estas funciones.

-- ============================================================
-- 1) Pruebas vencidas → suspended (trial_expired), con auditoría
-- ============================================================
-- AUTH-ONBOARDING §5: `trialing` con `trial_ends_at` pasado y sin suscripción de Stripe pasa a
-- `suspended` con `status_reason = 'trial_expired'`. Las demos se excluyen (el reset las recrea).
-- `skip locked`: si otra ejecución (o el admin) tiene el tenant bloqueado, se toma mañana.
create or replace function public.expire_trials()
returns table (tenant_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  for v_row in
    select t.id, t.slug
    from public.tenants t
    where t.status = 'trialing'
      and t.trial_ends_at is not null
      and t.trial_ends_at <= now()
      and t.stripe_subscription_id is null
      and not t.is_demo
    order by t.trial_ends_at
    for update skip locked
  loop
    update public.tenants
    set status = 'suspended', status_reason = 'trial_expired'
    where id = v_row.id;

    insert into public.audit_log (tenant_id, actor_id, action, payload)
    values (v_row.id, null, 'tenant.status_changed',
            jsonb_build_object('from', 'trialing', 'to', 'suspended', 'reason', 'trial_expired', 'by', 'cron'));

    tenant_id := v_row.id;
    slug := v_row.slug;
    return next;
  end loop;
end;
$$;

revoke execute on function public.expire_trials() from public, anon, authenticated;
grant execute on function public.expire_trials() to service_role;

-- ============================================================
-- 2) Reinicio mensual de usage.quotes_this_month
-- ============================================================
-- `usage_quotes_sync` (0008) ya reinicia el contador con la primera cotización del mes, pero un
-- tenant que no cotiza seguiría mostrando el número del mes pasado en el admin. Mismo mes que usa
-- el trigger (`to_char(now(), 'YYYY-MM')`, zona de la base) para que no se contradigan.
create or replace function public.reset_monthly_quotes()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_count int;
begin
  update public.usage u
  set quotes_this_month = 0, month_key = v_month, updated_at = now()
  where u.month_key is distinct from v_month;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reset_monthly_quotes() from public, anon, authenticated;
grant execute on function public.reset_monthly_quotes() to service_role;

-- ============================================================
-- 3) Medios: reservas vencidas y llaves de R2 sin dueño
-- ============================================================
-- Una reserva `pending` que nunca se confirmó (el navegador se cerró a media subida) no cuenta en
-- la cuota, pero su objeto puede haber llegado a R2. `reserve_media` borra las del tenant que vuelve
-- a subir; esta limpia las de todos y devuelve sus llaves para borrarlas de R2. Una hora de margen:
-- la URL firmada dura 5 minutos.
create or replace function public.purge_stale_pending_media(p_older_than interval default interval '1 hour')
returns table (r2_key text, thumb_key text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_older_than is null or p_older_than < interval '15 minutes' then
    raise exception 'invalid_params' using errcode = '22023';
  end if;
  return query
  delete from public.media m
  where m.status = 'pending' and m.created_at < now() - p_older_than
  returning m.r2_key, m.thumb_key;
end;
$$;

revoke execute on function public.purge_stale_pending_media(interval) from public, anon, authenticated;
grant execute on function public.purge_stale_pending_media(interval) to service_role;

-- De una página del listado de R2 (hasta 1000 llaves), devuelve las que NADIE referencia: ni una
-- fila de `media` (ready o pending), ni un ítem (`images`/`floor_plan_url`), ni un logo, ni el
-- snapshot de una cotización sin vencer. La búsqueda es global, no por tenant: "clonar demo"
-- copia URLs de ítems a otro tenant, así que una llave `t/<A>/...` puede estar en uso por B. De
-- cada URL se extrae la llave (`/t/<uuid>/...`) y de un `-full.webp` también se da por usada su
-- miniatura (`thumbUrl` la deriva sin guardarla). Conservadora a propósito: ante cualquier
-- referencia, la llave se queda. Solo mira llaves bajo `t/`.
create or replace function public.orphan_media_keys(p_keys text[])
returns setof text
language sql
security definer
stable
set search_path = public
as $$
  with urls as (
    select u as url from public.items i, unnest(i.images) as u
    union all
    select i.floor_plan_url from public.items i where i.floor_plan_url is not null
    union all
    select t.logo_url from public.tenants t where t.logo_url is not null
    union all
    select m[1] from public.quotes q,
      regexp_matches(q.snapshot::text, '(/t/[0-9a-fA-F-]{36}/[^"\s?#]+)', 'g') as m
    where q.expires_at is null or q.expires_at > now()
  ),
  url_keys as (
    select substring(url from '/(t/[0-9a-fA-F-]{36}/[^"\s?#]+)') as key from urls
  ),
  used as (
    select key from url_keys where key is not null
    union
    select regexp_replace(key, '-full\.webp$', '-thumb.webp') from url_keys where key like '%-full.webp'
    union
    select m.r2_key from public.media m
    union
    select m.thumb_key from public.media m where m.thumb_key is not null
  )
  select distinct k
  from unnest(coalesce(p_keys, '{}')) as k
  where k like 't/%'
    and not exists (select 1 from used where used.key = k);
$$;

revoke execute on function public.orphan_media_keys(text[]) from public, anon, authenticated;
grant execute on function public.orphan_media_keys(text[]) to service_role;

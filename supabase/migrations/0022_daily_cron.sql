-- T17: cron diario de Vercel (vence pruebas, resetea el contador mensual de cotizaciones; la
-- limpieza de huérfanos de R2 vive en lib/media-cleanup.ts porque necesita listar el bucket, algo
-- que no se puede hacer desde SQL). Igual que reset_demo_data (T26), cada función es invocable
-- sola y su propio SELECT ... FOR UPDATE la hace segura de correr dos veces seguidas.

-- ============================================================
-- 1) Vencer pruebas: trialing + trial_ends_at pasado + sin suscripción de Stripe → suspended.
--    is_demo queda fuera (docs/DEMO.md: demo-prueba nace trialing a 7 días y el reset nocturno ya
--    la recrea; no debe caer en `suspended` por el cron). `skip locked` deja pasar una fila que ya
--    esté tomada por otra corrida del cron en paralelo en vez de esperarla.
-- ============================================================
create or replace function public.expire_trials()
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
    where status = 'trialing'
      and is_demo = false
      and trial_ends_at is not null
      and trial_ends_at < now()
      and stripe_subscription_id is null
    order by id
    for update skip locked
  loop
    return next public.set_tenant_status(v_tenant.id, 'suspended', 'trial_expired', null);
  end loop;
  return;
end;
$$;

revoke execute on function public.expire_trials() from public, anon, authenticated;
grant execute on function public.expire_trials() to service_role;

-- ============================================================
-- 2) Resetear usage.quotes_this_month al cambiar de mes (nadie la incrementa todavía: la deja
--    lista para cuando T20/T21 agreguen un tope mensual por plan).
-- ============================================================
create or replace function public.reset_monthly_quote_counters()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_count int;
begin
  update public.usage set quotes_this_month = 0, month_key = v_month, updated_at = now()
  where month_key <> v_month;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.reset_monthly_quote_counters() from public, anon, authenticated;
grant execute on function public.reset_monthly_quote_counters() to service_role;

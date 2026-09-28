-- Tests de 0022_daily_cron.sql (T17). Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@test.local'),
  ('00000000-0000-0000-0000-0000000000d4', 'd4@test.local');

-- prueba vencida, sin suscripción → debe pasar a suspended
select set_config('t.expired', public.provision_tenant('00000000-0000-0000-0000-0000000000d1', 'Vencida', 'negocio-vencida', 'broker', 'trialing', 1, 'self_signup', 'manual')::text, true);
update public.tenants set trial_ends_at = now() - interval '1 day' where id = current_setting('t.expired')::uuid;

-- prueba vencida pero ya con suscripción de Stripe → no debe tocarse (T20 se encarga por webhook)
select set_config('t.subscribed', public.provision_tenant('00000000-0000-0000-0000-0000000000d2', 'Con suscripción', 'negocio-suscrita', 'broker', 'trialing', 1, 'self_signup', 'stripe')::text, true);
update public.tenants set trial_ends_at = now() - interval '1 day', stripe_subscription_id = 'sub_test123' where id = current_setting('t.subscribed')::uuid;

-- prueba vigente → no debe tocarse
select set_config('t.fresh', public.provision_tenant('00000000-0000-0000-0000-0000000000d3', 'Vigente', 'negocio-vigente', 'broker', 'trialing', 7, 'self_signup', 'manual')::text, true);

-- demo vencida (no debería existir en la práctica, pero is_demo siempre queda fuera) → no debe tocarse
select set_config('t.demo', public.provision_tenant('00000000-0000-0000-0000-0000000000d4', 'Demo vieja', 'negocio-demo-vieja', 'broker', 'trialing', 1, 'self_signup', 'manual')::text, true);
update public.tenants set trial_ends_at = now() - interval '1 day', is_demo = true where id = current_setting('t.demo')::uuid;

select results_eq(
  format($$select slug from public.expire_trials() as slug order by 1$$),
  $$values ('negocio-vencida'::text)$$,
  'expire_trials solo vence la prueba sin suscripción y sin is_demo'
);
select is((select status from public.tenants where id = current_setting('t.expired')::uuid), 'suspended', 'la vencida queda suspended');
select is((select status_reason from public.tenants where id = current_setting('t.expired')::uuid), 'trial_expired', 'motivo trial_expired');
select is((select status from public.tenants where id = current_setting('t.subscribed')::uuid), 'trialing', 'con suscripción no se toca');
select is((select status from public.tenants where id = current_setting('t.fresh')::uuid), 'trialing', 'la vigente no se toca');
select is((select status from public.tenants where id = current_setting('t.demo')::uuid), 'trialing', 'la demo no se toca');

select is((select count(*) from public.expire_trials()), 0::bigint, 'expire_trials es idempotente: nada que vencer en la segunda corrida');

-- reset_monthly_quote_counters
update public.usage set quotes_this_month = 5, month_key = '2000-01' where tenant_id = current_setting('t.fresh')::uuid;
select isnt((select quotes_this_month from public.usage where tenant_id = current_setting('t.demo')::uuid), 5, 'sanity: el otro tenant no se tocó todavía');
update public.usage set quotes_this_month = 3 where tenant_id = current_setting('t.demo')::uuid; -- mismo mes, no debe resetearse

select is((select public.reset_monthly_quote_counters() >= 1), true, 'resetea al menos la fila de mes viejo');
select is((select quotes_this_month from public.usage where tenant_id = current_setting('t.fresh')::uuid), 0, 'mes viejo: contador en 0');
select is((select month_key from public.usage where tenant_id = current_setting('t.fresh')::uuid), to_char(now(), 'YYYY-MM'), 'mes viejo: month_key al mes actual');
select is((select quotes_this_month from public.usage where tenant_id = current_setting('t.demo')::uuid), 3, 'mes actual: no se toca');

select is((select public.reset_monthly_quote_counters()), 0, 'reset_monthly_quote_counters es idempotente');

-- privilegios: solo service_role
select is(has_function_privilege('anon', 'public.expire_trials()', 'execute'), false, 'anon no ejecuta expire_trials');
select is(has_function_privilege('authenticated', 'public.expire_trials()', 'execute'), false, 'authenticated no ejecuta expire_trials');
select is(has_function_privilege('anon', 'public.reset_monthly_quote_counters()', 'execute'), false, 'anon no ejecuta reset_monthly_quote_counters');

select * from finish();
rollback;

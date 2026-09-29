-- Tests de 0025_stripe.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local');

select set_config('t.ta', public.provision_tenant('00000000-0000-0000-0000-0000000000f1', 'Negocio F', 'negocio-cobro-f', 'broker', 'active', null, 'admin', 'manual')::text, true);
-- broker_pro (tope de 300 items) para poder insertar 51 y probar el downgrade a esencial (tope 50)
select set_config('t.tb', public.provision_tenant('00000000-0000-0000-0000-0000000000f2', 'Negocio G', 'negocio-cobro-g', 'broker_pro', 'active', null, 'admin', 'manual')::text, true);

-- ============================================================
-- 1) stripe_events: la clave primaria es la idempotencia (el webhook la usa como "ya lo procesé")
-- ============================================================
insert into public.stripe_events (id, type) values ('evt_test_1', 'checkout.session.completed');
select throws_ok(
  $$insert into public.stripe_events (id, type) values ('evt_test_1', 'checkout.session.completed')$$,
  '23505', null, 'un evento repetido choca con la primary key'
);
select is(has_table_privilege('anon', 'public.stripe_events', 'select'), false, 'anon no lee stripe_events');
select is(has_table_privilege('authenticated', 'public.stripe_events', 'select'), false, 'authenticated no lee stripe_events');

-- ============================================================
-- 2) subscriptions: solo la lee cada tenant la suya (y admin), solo escribe service_role
-- ============================================================
insert into public.subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, collection_method, current_period_end)
values (current_setting('t.ta')::uuid, 'cus_a', 'sub_a', 'price_a', 'active', 'charge_automatically', now() + interval '30 days');
insert into public.subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, collection_method, current_period_end)
values (current_setting('t.tb')::uuid, 'cus_b', 'sub_b', 'price_b', 'active', 'charge_automatically', now() + interval '30 days');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.subscriptions), 1, 'el dueño de A solo ve la suscripción de A');
select throws_ok($$update public.subscriptions set status = 'canceled'$$, '42501', null, 'authenticated no edita subscriptions (solo service_role)');
reset role;
select set_config('request.jwt.claims', null, true);

-- ============================================================
-- 3) status_changed_at: set_tenant_status lo actualiza solo cuando el estado cambia de verdad
-- ============================================================
select public.set_tenant_status(current_setting('t.ta')::uuid, 'past_due', 'card_declined', null);
select ok((select status_changed_at from public.tenants where id = current_setting('t.ta')::uuid) > now() - interval '1 minute', 'status_changed_at se actualiza al cambiar de estado');

update public.tenants set status_changed_at = now() - interval '1 hour' where id = current_setting('t.ta')::uuid;
select public.set_tenant_status(current_setting('t.ta')::uuid, 'past_due', 'otra_razon', null);
select ok((select status_changed_at from public.tenants where id = current_setting('t.ta')::uuid) < now() - interval '30 minutes', 'llamar con el mismo estado no reinicia status_changed_at');

-- ============================================================
-- 4) plan_usage_overages: bloquea el downgrade cuando el uso ya no cabe en el plan nuevo.
--    La llama `app/api/[tenant]/billing/checkout` con el cliente de sesión (nunca service role
--    ahí), así que valida membresía ella misma: se simula al dueño de B, igual que tenant_rls.sql.
-- ============================================================
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
set local role authenticated;

select is_empty(
  $$select * from public.plan_usage_overages(current_setting('t.tb')::uuid, 'esencial')$$,
  'sin ítems todavía, esencial (50 items) no se rebasa'
);

insert into public.items (kind, tenant_id, title, sku, price)
select 'service', current_setting('t.tb')::uuid, 'Servicio ' || i, 'SKU-' || i, 10
from generate_series(1, 51) i;

select results_eq(
  $$select key, used, allowed from public.plan_usage_overages(current_setting('t.tb')::uuid, 'esencial') order by key$$,
  $$values ('items'::text, 51::bigint, 50::bigint)$$,
  '51 items ya no caben en esencial (tope 50)'
);
select is_empty(
  $$select * from public.plan_usage_overages(current_setting('t.tb')::uuid, 'broker_pro')$$,
  'los mismos 51 items sí caben en broker_pro (tope 300)'
);
reset role;
select set_config('request.jwt.claims', null, true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$select * from public.plan_usage_overages(current_setting('t.tb')::uuid, 'esencial')$$,
  'el dueño de A no ve el sobreuso de B (no es miembro)'
);
reset role;
select set_config('request.jwt.claims', null, true);

-- ============================================================
-- 5) expire_past_due: Stripe no manda webhook para esto, lo deriva el cron del tiempo en past_due
-- ============================================================
update public.tenants set status = 'past_due', status_changed_at = now() - interval '3 days' where id = current_setting('t.ta')::uuid;
select is((select public.expire_past_due()), null, 'a 3 días de past_due, todavía no se suspende');
select is((select status from public.tenants where id = current_setting('t.ta')::uuid), 'past_due', 'sigue en past_due');

update public.tenants set status_changed_at = now() - interval '8 days' where id = current_setting('t.ta')::uuid;
select results_eq(
  $$select public.expire_past_due()$$,
  $$values ('negocio-cobro-f'::text)$$,
  'a 8 días de past_due, se suspende'
);
select is((select status from public.tenants where id = current_setting('t.ta')::uuid), 'suspended', 'quedó suspendido');
select is((select status_reason from public.tenants where id = current_setting('t.ta')::uuid), 'payment_failed', 'con la razón correcta');

select is(has_function_privilege('anon', 'public.plan_usage_overages(uuid, text)', 'execute'), false, 'anon no ejecuta plan_usage_overages');
select is(has_function_privilege('authenticated', 'public.plan_usage_overages(uuid, text)', 'execute'), true, 'authenticated sí (valida membresía adentro)');
select is(has_function_privilege('anon', 'public.expire_past_due()', 'execute'), false, 'anon no ejecuta expire_past_due');

select * from finish();
rollback;

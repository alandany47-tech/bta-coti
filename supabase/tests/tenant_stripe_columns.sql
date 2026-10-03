-- Regresión de 0033: el select que hace la ruta de checkout (plan, customer, suscripción y sesión
-- de Checkout) tiene que funcionar para el dueño con el cliente de sesión. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000001301', 's1@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-000000001301', 'Negocio S', 'negocio-s', 'esencial', 'active', null, 'admin', 'manual')::text, true);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001301","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select plan_id, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id from public.tenants where id = %L$$, current_setting('t.a')), 'el dueño lee las columnas de Stripe que usa el checkout');
select throws_ok($$select notes from public.tenants limit 1$$, '42501', null, 'notes sigue fuera del grant');
reset role;

set local role anon;
select throws_ok($$select stripe_checkout_session_id from public.tenants limit 1$$, '42501', null, 'anon no lee stripe_checkout_session_id');
reset role;

select * from finish();
rollback;

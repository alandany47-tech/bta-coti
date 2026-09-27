-- Tests de 0020_demo.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

select is((select count(*)::int from public.tenants where slug like 'demo-%'), 0, 'sin demos previas en este entorno de prueba');
select lives_ok($$select public.reset_demo_data('Testpass123!')$$, 'reset_demo_data corre sin errores');
select is((select count(*)::int from public.tenants where slug like 'demo-%' and is_demo), 8, 'crea los 8 tenants de demo');
select is((select count(*)::int from auth.users where email like '%@demo.ayx.test'), 12, 'crea los 12 usuarios de demo');
select is((select status from public.tenants where slug = 'demo-suspendida'), 'suspended', 'demo-suspendida queda suspendido');
select is((select status from public.tenants where slug = 'demo-prueba'), 'trialing', 'demo-prueba queda en prueba');
select ok((select count(*)::int from public.items where tenant_id = (select id from public.tenants where slug = 'demo-broker')) > 0, 'demo-broker trae ítems');
select ok((select count(*)::int from public.quotes where tenant_id = (select id from public.tenants where slug = 'demo-broker')) > 0, 'demo-broker trae cotizaciones');

-- Vuelve a correr: debe seguir siendo exactamente 8 tenants y 12 usuarios (reset, no acumula).
select lives_ok($$select public.reset_demo_data('OtroPass456!')$$, 'reset_demo_data es idempotente');
select is((select count(*)::int from public.tenants where slug like 'demo-%'), 8, 'sigue habiendo 8 tenants tras un segundo reset');
select is((select count(*)::int from auth.users where email like '%@demo.ayx.test'), 12, 'sigue habiendo 12 usuarios tras un segundo reset');

-- is_demo visible para anon/authenticated
set local role anon;
select is((select is_demo from public.tenants where slug = 'demo-broker'), true, 'anon ve is_demo');
reset role;

-- clone_demo_items
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000001301', 'clone-owner@test.local');
select set_config('t.p', public.provision_tenant('00000000-0000-0000-0000-000000001301', 'Prospecto X', 'prospecto-x-test', 'broker', 'trialing', 7, 'admin', 'manual')::text, true);
select is((select public.clone_demo_items((select id from public.tenants where slug = 'demo-broker'), current_setting('t.p')::uuid)) > 0, true, 'clona al menos un ítem');
select is((select count(*)::int from public.items where tenant_id = current_setting('t.p')::uuid), (select count(*)::int from public.items where tenant_id = (select id from public.tenants where slug = 'demo-broker')), 'copia todos los ítems del origen');
select is((select count(*)::int from public.clients where tenant_id = current_setting('t.p')::uuid), 0, 'no copia clientes');
select is((select count(*)::int from public.quotes where tenant_id = current_setting('t.p')::uuid), 0, 'no copia cotizaciones');
select is((select brand_color from public.tenants where id = current_setting('t.p')::uuid), (select brand_color from public.tenants where slug = 'demo-broker'), 'copia el color de marca');
select throws_ok(format($$select public.clone_demo_items(%L, current_setting('t.p')::uuid)$$, current_setting('t.p')), '22023', 'source_not_demo', 'no se puede clonar un tenant que no es demo');

set local role anon;
select throws_ok($$select public.reset_demo_data('x')$$, '42501', null, 'anon no ejecuta el reset');
select throws_ok(format($$select public.clone_demo_items(%L, %L)$$, current_setting('t.p'), current_setting('t.p')), '42501', null, 'anon no clona ítems');
reset role;

select * from finish();
rollback;

-- Tests de 0014_items.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-0000000000d1', 'Negocio K', 'negocio-k', 'broker', 'active', null, 'admin', 'manual')::text, true);
insert into public.tenant_members (tenant_id, user_id, role) values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000000d2', 'viewer');

select is(to_regclass('public.properties'), null, 'properties ya no existe');
select is((select items_count from public.usage where tenant_id = current_setting('t.a')::uuid), 0, 'usage arranca en 0');

insert into public.items (id, tenant_id, kind, title, sku, price, attrs) values
  ('00000000-0000-0000-0000-00000000dd01', current_setting('t.a')::uuid, 'property', 'Depto', 'A1', 1500000, '{"unit_number":"A1","m2_total":80}'),
  ('00000000-0000-0000-0000-00000000dd02', current_setting('t.a')::uuid, 'service', 'Asesoría', null, 500, '{}'),
  ('00000000-0000-0000-0000-00000000dd03', current_setting('t.a')::uuid, 'product', 'Oculto', null, 10, '{}');
update public.items set status = 'hidden' where id = '00000000-0000-0000-0000-00000000dd03';

select is((select items_count from public.usage where tenant_id = current_setting('t.a')::uuid), 3, 'usage cuenta los tres ítems');
select throws_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'otro', 'x')$$, current_setting('t.a')), '23514', null, 'kind inválido rechazado');
select throws_ok(format($$insert into public.items (tenant_id, kind, title, sku) values (%L, 'property', 'x', 'A1')$$, current_setting('t.a')), '23505', null, 'sku único por tenant');
select lives_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'service', 'Sin sku 1'), (%L, 'service', 'Sin sku 2')$$, current_setting('t.a'), current_setting('t.a')), 'varios ítems sin sku');
select throws_ok(format($$insert into public.items (tenant_id, kind, title, price) values (%L, 'product', 'x', -1)$$, current_setting('t.a')), '23514', null, 'precio negativo rechazado');

set local role anon;
select is((select count(*)::int from public.items where tenant_id = current_setting('t.a')::uuid), 4, 'anon ve los no ocultos');
select is((select count(*)::int from public.items where id = '00000000-0000-0000-0000-00000000dd03'), 0, 'anon no ve el oculto');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.items where id = '00000000-0000-0000-0000-00000000dd03'), 1, 'un miembro ve el oculto');
select throws_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'service', 'x')$$, current_setting('t.a')), '42501', null, 'viewer no inserta');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.quotes (tenant_id, property_id, client_name, client_phone, discount_pct, down_payment_pct, down_payment_amount, installments_count, monthly_payment_amount, final_payment_amount, total_amount) values (%L, '00000000-0000-0000-0000-00000000dd01', 'C', '5500000000', 0, 10, 1, 1, 1, 1, 1)$$, current_setting('t.a')), 'cotización ligada a un ítem propio');
reset role;

delete from public.items where id = '00000000-0000-0000-0000-00000000dd01';
select is((select property_id from public.quotes where tenant_id = current_setting('t.a')::uuid limit 1), null, 'borrar el ítem deja property_id en null');
select is((select items_count from public.usage where tenant_id = current_setting('t.a')::uuid), 4, 'usage baja al borrar');

select * from finish();
rollback;

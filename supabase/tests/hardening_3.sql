-- Tests de 0013_hardening_3.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Negocio I', 'negocio-i', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.b', public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Negocio J', 'negocio-j', 'broker', 'active', null, 'admin', 'manual')::text, true);
insert into public.properties (id, tenant_id, title, unit_number, list_price)
  values ('00000000-0000-0000-0000-00000000cc01', current_setting('t.a')::uuid, 'P', '1', 1);
insert into public.clients (id, tenant_id, full_name, phone)
  values ('00000000-0000-0000-0000-00000000cc02', current_setting('t.a')::uuid, 'C', '5500000000');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$update public.properties set tenant_id = %L where id = '00000000-0000-0000-0000-00000000cc01'$$, current_setting('t.b')), '42501', 'tenant_id_immutable', 'properties: no se mueve de tenant');
select throws_ok(format($$update public.clients set tenant_id = %L where id = '00000000-0000-0000-0000-00000000cc02'$$, current_setting('t.b')), '42501', 'tenant_id_immutable', 'clients: no se mueve de tenant');
select lives_ok($$update public.properties set title = 'P2' where id = '00000000-0000-0000-0000-00000000cc01'$$, 'properties: otras columnas siguen editables');
reset role;

select throws_ok(format($$select public.set_tenant_status(%L, 'trialing', null, null)$$, current_setting('t.a')), '22023', 'invalid_status', 'no se pasa a trialing por set_tenant_status');
select lives_ok(format($$select public.set_tenant_status(%L, 'past_due', null, null)$$, current_setting('t.a')), 'los demás estados siguen');

select * from finish();
rollback;

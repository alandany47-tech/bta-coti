-- Tests de 0011_access_by_status.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a9', 'g1@test.local');
select set_config('t.t', public.provision_tenant('00000000-0000-0000-0000-0000000000a9', 'Negocio G', 'negocio-g', 'broker', 'active', null, 'admin', 'manual')::text, true);
insert into public.clients (tenant_id, full_name, phone) values (current_setting('t.t')::uuid, 'Cliente', '1');
insert into public.items (kind, tenant_id, title, sku, price) values ('property', current_setting('t.t')::uuid, 'P', '1', 1);
insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-0000000000a9');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);

-- activo: lee
set local role authenticated;
select is((select count(*)::int from public.clients), 1, 'tenant activo: el miembro lee clientes');
reset role;

-- suspendido: no lee PII
update public.tenants set status = 'suspended' where id = current_setting('t.t')::uuid;
set local role authenticated;
select is((select count(*)::int from public.clients), 0, 'tenant suspendido: no lee clientes');
select is((select count(*)::int from public.quotes), 0, 'tenant suspendido: no lee cotizaciones');
reset role;
set local role anon;
select is((select count(*)::int from public.items where tenant_id = current_setting('t.t')::uuid), 0, 'tenant suspendido: el público no ve propiedades');
reset role;

-- past_due: sigue todo operable
update public.tenants set status = 'past_due' where id = current_setting('t.t')::uuid;
set local role authenticated;
select is((select count(*)::int from public.clients), 1, 'past_due: el miembro lee clientes');
reset role;
set local role anon;
select is((select count(*)::int from public.items where tenant_id = current_setting('t.t')::uuid), 1, 'past_due: el público ve propiedades');
reset role;

-- el admin ya no cambia el estado directo por REST
set local role authenticated;
select throws_ok(format($$update public.tenants set status = 'active' where id = %L$$, current_setting('t.t')), '42501', null, 'authenticated no actualiza tenants directo');
reset role;

select * from finish();
rollback;

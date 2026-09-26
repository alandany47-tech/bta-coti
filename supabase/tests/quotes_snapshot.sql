-- Tests de 0016_quotes_snapshot.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-0000000000f1', 'Negocio N', 'negocio-n', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.b', public.provision_tenant('00000000-0000-0000-0000-0000000000f2', 'Negocio O', 'negocio-o', 'broker', 'active', null, 'admin', 'manual')::text, true);

insert into public.quotes (id, tenant_id, client_name, client_phone, snapshot, status) values
  ('00000000-0000-0000-0000-00000000f001', current_setting('t.a')::uuid, 'A1', '1', '{"version":1,"clientName":"A1"}', 'sent'),
  ('00000000-0000-0000-0000-00000000f002', current_setting('t.a')::uuid, 'A2', '2', '{"version":1}', 'sent'),
  ('00000000-0000-0000-0000-00000000f003', current_setting('t.b')::uuid, 'B1', '3', '{"version":1}', 'sent');

select is((select array_agg(number order by number) from public.quotes where tenant_id = current_setting('t.a')::uuid), array[1, 2], 'número consecutivo por tenant');
select is((select number from public.quotes where id = '00000000-0000-0000-0000-00000000f003'), 1, 'cada tenant arranca en 1');
select ok((select length(share_token) >= 64 from public.quotes where id = '00000000-0000-0000-0000-00000000f001'), 'token largo generado por la base');
select ok((select expires_at > now() + interval '29 days' from public.quotes where id = '00000000-0000-0000-0000-00000000f001'), 'vigencia de 30 días');
select throws_ok(format($$insert into public.quotes (tenant_id, client_name, client_phone) values (%L, 'x', '1')$$, current_setting('t.a')), '23502', null, 'el snapshot es obligatorio');

select set_config('t.tok', (select share_token from public.quotes where id = '00000000-0000-0000-0000-00000000f001'), true);

set local role anon;
select is((select (snapshot ->> 'clientName') from public.get_shared_quote(current_setting('t.tok'))), 'A1', 'anon lee el snapshot por token');
select is((select status from public.get_shared_quote(current_setting('t.tok'))), 'viewed', 'la primera vista marca viewed');
select is((select views from public.get_shared_quote(current_setting('t.tok'))), 3, 'cada lectura suma una vista');
select is((select count(*)::int from public.get_shared_quote('corto')), 0, 'token inválido no devuelve nada');
select throws_ok($$select * from public.quotes$$, '42501', null, 'anon no lee la tabla');
reset role;

update public.quotes set expires_at = now() - interval '1 day' where id = '00000000-0000-0000-0000-00000000f001';
select is((select expired from public.get_shared_quote(current_setting('t.tok'))), true, 'vencida se reporta expired');
select is((select views from public.quotes where id = '00000000-0000-0000-0000-00000000f001'), 3, 'una vencida no suma vistas');

update public.tenants set status = 'suspended' where id = current_setting('t.a')::uuid;
select is((select count(*)::int from public.get_shared_quote(current_setting('t.tok'))), 0, 'tenant suspendido: no se comparte');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.quotes set snapshot = '{}'$$, '42501', null, 'los usuarios no editan el snapshot');
select throws_ok($$delete from public.quotes$$, '42501', null, 'los usuarios no borran cotizaciones');
reset role;

select * from finish();
rollback;

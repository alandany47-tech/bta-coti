-- Tests de 0008_admin_ops.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'Dueño@Test.Local');
select set_config('t.t', public.provision_tenant('00000000-0000-0000-0000-0000000000d1', 'Negocio D', 'negocio-d', 'broker', 'active', null, 'admin', 'manual')::text, true);

select is(public.admin_user_id_by_email(' dueño@test.local '), '00000000-0000-0000-0000-0000000000d1'::uuid, 'busca usuario por correo sin importar mayúsculas');
select is(public.admin_user_id_by_email('nadie@test.local'), null, 'correo inexistente devuelve null');

select is((select items_count from public.usage where tenant_id = current_setting('t.t')::uuid), 0, 'usage empieza en 0');
insert into public.items (kind, tenant_id, title, sku, price) values
  ('property', current_setting('t.t')::uuid, 'P1', '1', 10), ('property', current_setting('t.t')::uuid, 'P2', '2', 10);
select is((select items_count from public.usage where tenant_id = current_setting('t.t')::uuid), 2, 'insertar propiedades suma items_count');
delete from public.items where tenant_id = current_setting('t.t')::uuid and sku = '2';
select is((select items_count from public.usage where tenant_id = current_setting('t.t')::uuid), 1, 'borrar propiedad resta items_count');

insert into public.quotes (tenant_id, client_name, client_phone) values (current_setting('t.t')::uuid, 'x', '1'), (current_setting('t.t')::uuid, 'y', '2');
select is((select quotes_this_month from public.usage where tenant_id = current_setting('t.t')::uuid), 2, 'cotizaciones del mes suman');
update public.usage set month_key = '2000-01', quotes_this_month = 9 where tenant_id = current_setting('t.t')::uuid;
insert into public.quotes (tenant_id, client_name, client_phone) values (current_setting('t.t')::uuid, 'z', '3');
select is((select quotes_this_month from public.usage where tenant_id = current_setting('t.t')::uuid), 1, 'el contador se reinicia al cambiar de mes');

select is(public.set_tenant_status(current_setting('t.t')::uuid, 'suspended', 'Falta de pago', '00000000-0000-0000-0000-0000000000d1'), 'negocio-d', 'set_tenant_status devuelve el slug');
select is((select status from public.tenants where id = current_setting('t.t')::uuid), 'suspended', 'estado actualizado');
select is((select payload->>'reason' from public.audit_log where tenant_id = current_setting('t.t')::uuid and action = 'tenant.status_changed'), 'Falta de pago', 'deja auditoría con motivo');
select throws_ok(format($$select public.set_tenant_status(%L, 'suspended', '  ', null)$$, current_setting('t.t')), '22023', 'reason_required', 'suspender exige motivo');
select throws_ok(format($$select public.set_tenant_status(%L, 'borrado', 'x', null)$$, current_setting('t.t')), '22023', 'invalid_status', 'estado inválido rechazado');
select throws_ok($$select public.set_tenant_status(gen_random_uuid(), 'active', null, null)$$, 'P0002', 'tenant_not_found', 'tenant inexistente');

set local role authenticated;
select throws_ok(format($$select public.set_tenant_status(%L, 'active', null, null)$$, current_setting('t.t')), '42501', null, 'authenticated no ejecuta set_tenant_status');
select throws_ok($$select public.admin_user_id_by_email('a@b.c')$$, '42501', null, 'authenticated no busca usuarios');
reset role;

select * from finish();
rollback;

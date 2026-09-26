-- Tests de 0006_tenant_rls.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ea@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'va@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'ob@test.local');

select set_config('t.ta', public.provision_tenant('00000000-0000-0000-0000-0000000000a1', 'Negocio A', 'tenant-a', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.tb', public.provision_tenant('00000000-0000-0000-0000-0000000000b1', 'Negocio B', 'tenant-b', 'broker', 'active', null, 'admin', 'manual')::text, true);
update public.tenant_members set role = 'editor' where user_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.tenant_members (tenant_id, user_id, role)
  values (current_setting('t.ta')::uuid, '00000000-0000-0000-0000-0000000000a2', 'viewer');

insert into public.items (kind, id, tenant_id, title, sku, price) values
  ('property', '00000000-0000-0000-0000-00000000aa01', current_setting('t.ta')::uuid, 'Casa A', 'A1', 100),
  ('property', '00000000-0000-0000-0000-00000000bb01', current_setting('t.tb')::uuid, 'Casa B', 'B1', 100);
insert into public.clients (id, tenant_id, full_name, phone) values
  ('00000000-0000-0000-0000-00000000ca01', current_setting('t.ta')::uuid, 'Cliente A', '111'),
  ('00000000-0000-0000-0000-00000000cb01', current_setting('t.tb')::uuid, 'Cliente B', '222');
insert into storage.objects (bucket_id, name) values
  ('property-media', current_setting('t.tb') || '/b.jpg');

-- anon
set local role anon;
select throws_ok($$insert into public.clients (tenant_id, full_name, phone) values (gen_random_uuid(), 'x', '1')$$, '42501', null, 'anon no inserta clientes');
select throws_ok($$select * from public.clients$$, '42501', null, 'anon no lee clientes');
select throws_ok($$select * from public.quotes$$, '42501', null, 'anon no lee cotizaciones');
select throws_ok($$update public.items set title = 'x'$$, '42501', null, 'anon no actualiza propiedades');
select throws_ok($$delete from public.items$$, '42501', null, 'anon no borra propiedades');
select cmp_ok((select count(*)::int from public.items), '>=', 2, 'anon lee propiedades públicas');
reset role;

-- editor de A (el borrado de objetos solo se permite vía la API de Storage: protect_delete)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.items (kind, tenant_id, title, sku, price) values ('property', %L, 'Nueva A', 'A2', 50)$$, current_setting('t.ta')), 'editor inserta propiedad en A');
select throws_ok(format($$insert into public.items (kind, tenant_id, title, sku, price) values ('property', %L, 'Intruso', 'B9', 50)$$, current_setting('t.tb')), '42501', null, 'editor de A no inserta propiedad en B');
select is_empty($$update public.items set title = 'x' where id = '00000000-0000-0000-0000-00000000bb01' returning id$$, 'editor de A no actualiza propiedad de B');
select is_empty($$delete from public.items where id = '00000000-0000-0000-0000-00000000bb01' returning id$$, 'editor de A no borra propiedad de B');
select is((select count(*)::int from public.clients), 1, 'editor de A solo ve clientes de A');
select throws_ok(format($$insert into public.clients (tenant_id, full_name, phone) values (%L, 'x', '1')$$, current_setting('t.tb')), '42501', null, 'editor de A no inserta cliente en B');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('property-media', %L)$$, current_setting('t.ta') || '/a.jpg'), '42501', null, 'editor ya no sube a property-media (los medios van a R2, 0012)');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('property-media', %L)$$, current_setting('t.tb') || '/x.jpg'), '42501', null, 'editor de A no sube a property-media de B');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('property-media', 'no-uuid/x.jpg')$$, '42501', null, 'carpeta que no es uuid rechazada');
reset role;

-- viewer de A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$insert into public.items (kind, tenant_id, title, sku, price) values ('property', %L, 'x', 'A3', 1)$$, current_setting('t.ta')), '42501', null, 'viewer no inserta propiedad');
select is_empty($$update public.items set title = 'x' where id = '00000000-0000-0000-0000-00000000aa01' returning id$$, 'viewer no actualiza propiedad');
select lives_ok(format($$insert into public.clients (tenant_id, full_name, phone) values (%L, 'Nuevo', '3')$$, current_setting('t.ta')), 'viewer crea cliente');
select is_empty($$update public.clients set full_name = 'x' returning id$$, 'viewer no edita clientes');
select is_empty($$delete from public.clients returning id$$, 'viewer no borra clientes');
select lives_ok(format($$insert into public.quotes (tenant_id, property_id, client_id, client_name, client_phone) values (%L, '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000ca01', 'Cliente A', '111')$$, current_setting('t.ta')), 'viewer crea cotización en A');
select throws_ok(format($$insert into public.quotes (tenant_id, client_name, client_phone) values (%L, 'x', '1')$$, current_setting('t.tb')), '42501', null, 'viewer de A no crea cotización en B');
select throws_ok(format($$insert into public.quotes (tenant_id, client_id, client_name, client_phone) values (%L, '00000000-0000-0000-0000-00000000cb01', 'x', '1')$$, current_setting('t.ta')), '42501', null, 'cotización de A no referencia cliente de B');
select is((select count(*)::int from public.quotes), 1, 'viewer solo ve cotizaciones de A');
select is_empty($$update public.quotes set notes = 'x' returning id$$, 'viewer no edita cotizaciones');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('quotes', %L)$$, current_setting('t.ta') || '/q.pdf'), 'viewer sube PDF a quotes de A');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('quotes', %L)$$, current_setting('t.tb') || '/q.pdf'), '42501', null, 'viewer no sube PDF a quotes de B');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('property-media', %L)$$, current_setting('t.ta') || '/v.jpg'), '42501', null, 'viewer no sube a property-media');
reset role;

select * from finish();
rollback;

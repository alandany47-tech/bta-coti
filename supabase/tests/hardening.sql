-- Tests de 0009_hardening.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local');
select set_config('t.t', public.provision_tenant('00000000-0000-0000-0000-0000000000e1', 'Negocio E', 'negocio-e', 'broker', 'active', null, 'admin', 'manual')::text, true);
update public.tenant_members set role = 'editor' where user_id = '00000000-0000-0000-0000-0000000000e1';

-- slugs reservados no se liberan con la allowlist
insert into public.blocked_terms_allow (slug) values ('login'), ('stripe');
select ok(public.is_slug_blocked('login'), 'login sigue bloqueado con allowlist');
select ok(public.is_slug_blocked('stripe'), 'stripe sigue bloqueado con allowlist');

-- past_due conserva escritura
update public.tenants set status = 'past_due' where id = current_setting('t.t')::uuid;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$insert into public.clients (tenant_id, full_name, phone) values (%L, 'x', '1')$$, current_setting('t.t')), 'past_due sí escribe');
reset role;

-- URLs de medios
set local role authenticated;
select lives_ok(format($$insert into public.properties (tenant_id, title, unit_number, list_price, images) values (%L, 'ok', '1', 1, array[%L])$$,
  current_setting('t.t'), 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/property-media/' || current_setting('t.t') || '/a.jpg'), 'URL propia aceptada');
select throws_ok(format($$insert into public.properties (tenant_id, title, unit_number, list_price, images) values (%L, 'x', '2', 1, array['http://169.254.169.254/latest'])$$, current_setting('t.t')), '22023', 'invalid_media_url', 'URL externa rechazada');
select throws_ok(format($$insert into public.properties (tenant_id, title, unit_number, list_price, images) values (%L, 'x', '3', 1, array[%L])$$,
  current_setting('t.t'), 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/property-media/00000000-0000-0000-0000-000000000001/a.jpg'), '22023', 'invalid_media_url', 'carpeta de otro tenant rechazada');
select throws_ok(format($$insert into public.properties (tenant_id, title, unit_number, list_price, images) values (%L, 'x', '4', 1, array[%L])$$,
  current_setting('t.t'), 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/property-media/' || current_setting('t.t') || '/../x.jpg'), '22023', 'invalid_media_url', 'traversal rechazado');
select throws_ok(format($$update public.properties set floor_plan_url = 'https://evil.example/p.png' where tenant_id = %L$$, current_setting('t.t')), '22023', 'invalid_media_url', 'plano externo rechazado');
reset role;

-- datos previos con URL externa: se pueden conservar al quitar otra imagen
insert into public.properties (id, tenant_id, title, unit_number, list_price, images)
  values ('00000000-0000-0000-0000-00000000ee01', current_setting('t.t')::uuid, 'legado', '9', 1, array['https://ext.example/1.jpg', 'https://ext.example/2.jpg']);
set local role authenticated;
select lives_ok($$update public.properties set images = array['https://ext.example/1.jpg'] where id = '00000000-0000-0000-0000-00000000ee01'$$, 'quitar una imagen legada no exige URL propia');
reset role;

select is((select allowed_mime_types from storage.buckets where id = 'quotes'), array['application/pdf'], 'quotes solo PDF');
select ok((select 'image/svg+xml' <> all (allowed_mime_types) from storage.buckets where id = 'property-media'), 'property-media rechaza SVG');

select * from finish();
rollback;

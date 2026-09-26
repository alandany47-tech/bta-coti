-- Tests de 0012_media_attach.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b9', 'b9@test.local');
select set_config('t.t', public.provision_tenant('00000000-0000-0000-0000-0000000000b9', 'Negocio H', 'negocio-h', 'broker', 'active', null, 'admin', 'manual')::text, true);
insert into public.properties (id, tenant_id, title, unit_number, list_price, images)
  values ('00000000-0000-0000-0000-00000000bb99', current_setting('t.t')::uuid, 'P', '1', 1, array['https://legacy.example/1.jpg']);

select is((select images from public.attach_media_url(current_setting('t.t')::uuid, '00000000-0000-0000-0000-00000000bb99', 'image', 'https://cdn.example/a.webp')), array['https://legacy.example/1.jpg', 'https://cdn.example/a.webp'], 'agrega la imagen al final');
select is((select images from public.attach_media_url(current_setting('t.t')::uuid, '00000000-0000-0000-0000-00000000bb99', 'image', 'https://cdn.example/a.webp')), array['https://legacy.example/1.jpg', 'https://cdn.example/a.webp'], 'no duplica la misma URL');
select is((select floor_plan_url from public.attach_media_url(current_setting('t.t')::uuid, '00000000-0000-0000-0000-00000000bb99', 'plan', 'https://cdn.example/plan.pdf')), 'https://cdn.example/plan.pdf', 'el plano reemplaza floor_plan_url');
select throws_ok(format($$select * from public.attach_media_url(%L, gen_random_uuid(), 'image', 'x')$$, current_setting('t.t')), 'P0002', 'item_not_found', 'propiedad inexistente');
select throws_ok(format($$select * from public.attach_media_url(gen_random_uuid(), '00000000-0000-0000-0000-00000000bb99', 'image', 'x')$$), 'P0002', 'item_not_found', 'propiedad de otro tenant');

select lives_ok(format($$select public.detach_media_url(%L, 'https://cdn.example/a.webp')$$, current_setting('t.t')), 'detach de imagen');
select is((select images from public.properties where id = '00000000-0000-0000-0000-00000000bb99'), array['https://legacy.example/1.jpg'], 'la imagen ya no está');
select lives_ok(format($$select public.detach_media_url(%L, 'https://cdn.example/plan.pdf')$$, current_setting('t.t')), 'detach de plano');
select is((select floor_plan_url from public.properties where id = '00000000-0000-0000-0000-00000000bb99'), null, 'plano limpio');

select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'property_media_%'), 0, 'sin políticas de property-media');

set local role authenticated;
select throws_ok(format($$select * from public.attach_media_url(%L, '00000000-0000-0000-0000-00000000bb99', 'image', 'x')$$, current_setting('t.t')), '42501', null, 'authenticated no ejecuta attach');
reset role;

select * from finish();
rollback;

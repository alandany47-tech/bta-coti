-- Tests de 0019_hardening_6.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001201', 'h1@test.local');
select set_config('t.es', public.provision_tenant('00000000-0000-0000-0000-000000001201', 'Negocio R', 'negocio-r', 'esencial', 'active', null, 'admin', 'manual')::text, true);

-- 1) items_quota_guard también valida el UPDATE que cambia de categoría
update public.plans set limits = jsonb_set(limits, '{properties}', '0') where code = 'esencial';
insert into public.items (id, tenant_id, kind, title, sku) values
  ('00000000-0000-0000-0000-00000000ee10', current_setting('t.es')::uuid, 'service', 'Servicio', 'S1');
select throws_ok(format($$update public.items set kind = 'property' where id = '00000000-0000-0000-0000-00000000ee10'$$), 'P0001', 'item_quota_exceeded', 'no se puede convertir un servicio en propiedad si el plan no admite propiedades');
select lives_ok($$update public.items set kind = 'product' where id = '00000000-0000-0000-0000-00000000ee10'$$, 'cambiar entre kinds no-propiedad no exige cupo');
select lives_ok(format($$insert into public.items (tenant_id, kind, title, sku, price) values (%L, 'product', 'Nuevo', 'S1', 5) on conflict (tenant_id, sku) do update set price = excluded.price, kind = excluded.kind$$, current_setting('t.es')), 'upsert que no cambia la categoría no se bloquea');
select throws_ok(format($$insert into public.items (tenant_id, kind, title, sku) values (%L, 'property', 'Casa', 'S1') on conflict (tenant_id, sku) do update set kind = excluded.kind$$, current_setting('t.es')), 'P0001', 'item_quota_exceeded', 'el import no puede reconvertir un ítem existente a propiedad saltando el cupo');

-- 2) límite por IP dentro de la base
delete from public.rpc_rate_limit;
select ok((select bool_and(public.check_rpc_rate_limit('t_bucket', 'ip.a', 3, 60)) from generate_series(1, 3)), 'las primeras 3 llamadas pasan');
select is((select public.check_rpc_rate_limit('t_bucket', 'ip.a', 3, 60)), false, 'la 4.ª llamada se bloquea');
select is((select public.check_rpc_rate_limit('t_bucket', 'ip.b', 3, 60)), true, 'otra key no comparte el cupo');
select is((select slug_available('otro-negocio-libre')), true, 'slug_available normal sigue funcionando');
select ok((select not bool_and(public.check_rpc_rate_limit('slug_available_min', 'ip.c', 20, 60)) from generate_series(1, 21)), 'slug_available_min también topa a 20/min');

-- 3) delete_media no borra un medio referenciado por una cotización vigente
insert into public.clients (tenant_id, full_name, phone) values (current_setting('t.es')::uuid, 'Cliente', '5500000000');
insert into public.media (id, tenant_id, item_id, kind, r2_key, thumb_key, content_type, bytes, thumb_bytes, status) values
  ('00000000-0000-0000-0000-00000000ee20', current_setting('t.es')::uuid, null, 'image', 't/x/_/abc123-full.webp', 't/x/_/abc123-thumb.webp', 'image/webp', 100, 10, 'ready');
insert into public.quotes (tenant_id, client_name, client_phone, snapshot, expires_at) values
  (current_setting('t.es')::uuid, 'C', '1', jsonb_build_object('property', jsonb_build_object('images', jsonb_build_array('https://media.ayx.solutions/t/x/_/abc123-full.webp'))), now() + interval '10 days');
select throws_ok(format($$select public.delete_media('00000000-0000-0000-0000-00000000ee20', %L)$$, current_setting('t.es')), 'P0001', 'media_in_use', 'no se borra un medio de una cotización vigente');
update public.quotes set expires_at = now() - interval '1 day' where tenant_id = current_setting('t.es')::uuid;
select lives_ok(format($$select public.delete_media('00000000-0000-0000-0000-00000000ee20', %L)$$, current_setting('t.es')), 'una vez vencida la cotización, el medio sí se puede borrar');
select is((select count(*)::int from public.media where id = '00000000-0000-0000-0000-00000000ee20'), 0, 'el medio quedó borrado');

select * from finish();
rollback;

-- Tests de 0024_hardening_9.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- ============================================================
-- 1) El respaldo por IP se salta a sí mismo con la llave de servicio, no con la anon.
--    `request.jwt.claims` es el mismo GUC que pone PostgREST según la llave con la que se llame;
--    lo simulamos a mano para probar las dos ramas sin pasar por HTTP.
-- ============================================================
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select ok(
  not (select bool_and(public.slug_available('nunca-anon-' || i)) from generate_series(1, 21) i),
  'anon: el límite de la base sigue bloqueando después de 20/min'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(
  (select bool_and(public.slug_available('nunca-servicio-' || i)) from generate_series(1, 25) i),
  'service_role: el límite de la base no lo toca ni pasando de 20 llamadas'
);

select set_config('request.jwt.claims', null, true);

-- ============================================================
-- 2) detached_at + retry_detached_media_deletes (0024)
-- ============================================================
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local');
select set_config('t.tenant', public.provision_tenant('00000000-0000-0000-0000-0000000000e1', 'Negocio E', 'negocio-e-hardening9', 'broker', 'active', null, 'admin', 'manual')::text, true);

insert into public.clients (tenant_id, full_name, phone) values (current_setting('t.tenant')::uuid, 'Cliente E', '5500000001');
insert into public.media (id, tenant_id, item_id, kind, status, r2_key, content_type, bytes)
  values ('00000000-0000-0000-0000-00000000e003', current_setting('t.tenant')::uuid, null, 'image', 'ready', 't/negocio-e/_/foto-full.webp', 'image/webp', 1000);

-- una cotización vigente que referencia esa llave en su snapshot bloquea el borrado
insert into public.quotes (tenant_id, client_name, client_phone, snapshot, expires_at) values
  (current_setting('t.tenant')::uuid, 'Cliente E', '5500000001',
   jsonb_build_object('property', jsonb_build_object('images', jsonb_build_array('https://media.ayx.solutions/t/negocio-e/_/foto-full.webp'))),
   now() + interval '10 days');

select throws_ok(
  format($$select public.delete_media('00000000-0000-0000-0000-00000000e003', %L)$$, current_setting('t.tenant')),
  'P0001', 'media_in_use', 'bloqueada por la cotización vigente'
);
select is((select detached_at from public.media where id = '00000000-0000-0000-0000-00000000e003'), null, 'delete_media por sí sola no marca detached_at (el update se revertiría con la excepción)');
select lives_ok(
  format($$select public.mark_media_detached('00000000-0000-0000-0000-00000000e003', %L)$$, current_setting('t.tenant')),
  'mark_media_detached es una llamada aparte, después de que el caller atrapa media_in_use'
);
select is((select detached_at is not null from public.media where id = '00000000-0000-0000-0000-00000000e003'), true, 'ahora sí queda marcado');
select is((select public.retry_detached_media_deletes()), 0, 'sigue bloqueada: el reintento no logra borrar nada todavía');
select is((select count(*) from public.media where id = '00000000-0000-0000-0000-00000000e003'), 1::bigint, 'la fila sigue existiendo');

-- la cotización vence: ahora sí se puede borrar
update public.quotes set expires_at = now() - interval '1 day' where tenant_id = current_setting('t.tenant')::uuid;
select is((select public.retry_detached_media_deletes()), 1, 'ya vencida la cotización, el reintento borra la fila');
select is((select count(*) from public.media where id = '00000000-0000-0000-0000-00000000e003'), 0::bigint, 'la fila ya no existe');

-- idempotente: nada que reintentar
select is((select public.retry_detached_media_deletes()), 0, 'retry_detached_media_deletes es idempotente');

select is(has_function_privilege('anon', 'public.retry_detached_media_deletes()', 'execute'), false, 'anon no ejecuta retry_detached_media_deletes');
select is(has_function_privilege('authenticated', 'public.retry_detached_media_deletes()', 'execute'), false, 'authenticated no ejecuta retry_detached_media_deletes');
select is(has_function_privilege('authenticated', 'public.mark_media_detached(uuid, uuid)', 'execute'), false, 'authenticated no ejecuta mark_media_detached (solo service_role, vía lib/media-store.ts)');

select * from finish();
rollback;

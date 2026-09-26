-- Tests de 0010_media.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-0000000000f1', 'Negocio F', 'negocio-f', 'esencial', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.b', public.provision_tenant('00000000-0000-0000-0000-0000000000f1', 'Negocio T', 'negocio-t', 'broker', 'trialing', 7, 'admin', 'manual')::text, true);

select is(public.effective_limit(current_setting('t.a')::uuid, 'storage_bytes'), 524288000::bigint, 'límite del plan activo');
select is(public.effective_limit(current_setting('t.b')::uuid, 'storage_bytes'), 209715200::bigint, 'en prueba manda el tope de 200 MB');
select is(public.effective_limit(current_setting('t.b')::uuid, 'images_per_item'), 5::bigint, 'en prueba manda el tope de 5 imágenes');
select is(public.effective_limit(current_setting('t.a')::uuid, 'plans_per_item'), 0::bigint, 'esencial no admite planos');

-- reserva + confirmación con tamaño real
select set_config('t.m', (select id::text from public.reserve_media(current_setting('t.a')::uuid, null, 'logo', 'image/webp', 1000, 100, 100, 100)), true);
select is((select status from public.media where id = current_setting('t.m')::uuid), 'pending', 'la reserva queda pending');
select is((select storage_bytes from public.usage where tenant_id = current_setting('t.a')::uuid), 0::bigint, 'pending no cuenta en usage');
select ok((select r2_key like 't/' || current_setting('t.a') || '/_/%-full.webp' from public.media where id = current_setting('t.m')::uuid), 'llave t/<tenant>/<item>/<id>-full.webp');
select lives_ok(format($$select public.confirm_media(%L, %L, 800, 90)$$, current_setting('t.m'), current_setting('t.a')), 'confirma con tamaño real');
select is((select storage_bytes from public.usage where tenant_id = current_setting('t.a')::uuid), 890::bigint, 'usage suma el tamaño real (full + thumb)');
select is((select bytes from public.media where id = current_setting('t.m')::uuid), 800::bigint, 'se registra el tamaño real, no el declarado');

-- borrar descuenta
select is((select count(*)::int from public.delete_media(current_setting('t.m')::uuid, current_setting('t.a')::uuid)), 1, 'delete_media devuelve las llaves');
select is((select storage_bytes from public.usage where tenant_id = current_setting('t.a')::uuid), 0::bigint, 'borrar descuenta usage');

-- cuota llena
select throws_ok(format($$select * from public.reserve_media(%L, null, 'logo', 'image/webp', 524288001, 0, 1, 1)$$, current_setting('t.a')), 'P0001', 'storage_quota_exceeded', 'reservar sobre la cuota falla');
select lives_ok(format($$select * from public.reserve_media(%L, null, 'logo', 'image/webp', 524288000, 0, 1, 1)$$, current_setting('t.a')), 'reservar justo la cuota funciona');
select throws_ok(format($$select * from public.reserve_media(%L, null, 'logo', 'image/webp', 1, 0, 1, 1)$$, current_setting('t.a')), 'P0001', 'storage_quota_exceeded', 'las reservas pendientes cuentan');

-- confirmar con tamaño real mayor al declarado (cliente que miente)
select set_config('t.c', (select id::text from public.reserve_media(current_setting('t.b')::uuid, null, 'cover', 'image/webp', 1000, 0, 1, 1)), true);
select throws_ok(format($$select public.confirm_media(%L, %L, 300000000, 0)$$, current_setting('t.c'), current_setting('t.b')), 'P0001', 'storage_quota_exceeded', 'el tamaño real sobre la cuota se rechaza');
select is((select status from public.media where id = current_setting('t.c')::uuid), 'pending', 'sigue pending tras el rechazo');

-- imágenes por ítem (prueba = 5)
insert into public.properties (id, tenant_id, title, unit_number, list_price)
  values ('00000000-0000-0000-0000-00000000ff01', current_setting('t.b')::uuid, 'P', '1', 1);
select lives_ok(format($$select * from public.reserve_media(%L, '00000000-0000-0000-0000-00000000ff01', 'image', 'image/webp', 10, 1, 1, 1)$$, current_setting('t.b')), 'imagen 1..5 permitidas') from generate_series(1, 5);
select throws_ok(format($$select * from public.reserve_media(%L, '00000000-0000-0000-0000-00000000ff01', 'image', 'image/webp', 10, 1, 1, 1)$$, current_setting('t.b')), 'P0001', 'item_media_limit', 'la 6.ª imagen se rechaza en prueba');
delete from public.media where tenant_id = current_setting('t.a')::uuid;
select throws_ok(format($$select * from public.reserve_media(%L, '00000000-0000-0000-0000-00000000ff01', 'plan', 'application/pdf', 10, 0, 1, 1)$$, current_setting('t.a')), 'P0001', 'item_media_limit', 'esencial no admite planos');

-- tenant no operable
update public.tenants set status = 'suspended' where id = current_setting('t.a')::uuid;
select throws_ok(format($$select * from public.reserve_media(%L, null, 'logo', 'image/webp', 1, 0, 1, 1)$$, current_setting('t.a')), '22023', 'tenant_not_operable', 'tenant suspendido no reserva');
update public.tenants set status = 'active' where id = current_setting('t.a')::uuid;

-- privilegios y lectura pública
set local role authenticated;
select throws_ok(format($$select * from public.reserve_media(%L, null, 'logo', 'image/webp', 1, 0, 1, 1)$$, current_setting('t.a')), '42501', null, 'authenticated no ejecuta reserve_media');
select throws_ok($$insert into public.media (tenant_id, kind, r2_key, content_type, bytes) values (gen_random_uuid(), 'logo', 'x', 'image/webp', 1)$$, '42501', null, 'authenticated no inserta media');
reset role;
insert into public.media (tenant_id, kind, status, r2_key, content_type, bytes)
  values (current_setting('t.a')::uuid, 'logo', 'ready', 'pub-key', 'image/webp', 1),
         (current_setting('t.a')::uuid, 'logo', 'pending', 'pend-key', 'image/webp', 1);
set local role anon;
select is((select count(*)::int from public.media where r2_key in ('pub-key', 'pend-key')), 1, 'anon solo ve medios ready');
reset role;

select * from finish();
rollback;

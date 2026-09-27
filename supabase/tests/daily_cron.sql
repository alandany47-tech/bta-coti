-- Tests de 0022_daily_cron.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001701', 'c1@test.local'),
  ('00000000-0000-0000-0000-000000001702', 'c2@test.local'),
  ('00000000-0000-0000-0000-000000001703', 'c3@test.local'),
  ('00000000-0000-0000-0000-000000001704', 'c4@test.local'),
  ('00000000-0000-0000-0000-000000001705', 'c5@test.local');
select set_config('t.venc', public.provision_tenant('00000000-0000-0000-0000-000000001701', 'Vencida', 'cron-vencida', 'esencial', 'trialing', 7, 'admin', 'manual')::text, true);
select set_config('t.vig', public.provision_tenant('00000000-0000-0000-0000-000000001702', 'Vigente', 'cron-vigente', 'esencial', 'trialing', 7, 'admin', 'manual')::text, true);
select set_config('t.stripe', public.provision_tenant('00000000-0000-0000-0000-000000001703', 'Con pago', 'cron-pagada', 'esencial', 'trialing', 7, 'admin', 'manual')::text, true);
select set_config('t.demo', public.provision_tenant('00000000-0000-0000-0000-000000001704', 'Muestra', 'cron-muestra', 'esencial', 'trialing', 7, 'admin', 'manual')::text, true);
select set_config('t.act', public.provision_tenant('00000000-0000-0000-0000-000000001705', 'Activa', 'cron-activa', 'broker', 'active', null, 'admin', 'manual')::text, true);
update public.tenants set trial_ends_at = now() - interval '1 hour'
where id in (current_setting('t.venc')::uuid, current_setting('t.stripe')::uuid, current_setting('t.demo')::uuid);
update public.tenants set stripe_subscription_id = 'sub_123' where id = current_setting('t.stripe')::uuid;
update public.tenants set is_demo = true where id = current_setting('t.demo')::uuid;

-- 1) expire_trials
select is((select array_agg(slug) from public.expire_trials()), array['cron-vencida'], 'solo vence la prueba pasada, sin Stripe y que no es demo');
select is((select status || '/' || status_reason from public.tenants where id = current_setting('t.venc')::uuid), 'suspended/trial_expired', 'queda suspendida con motivo trial_expired');
select is((select count(*)::int from public.audit_log where tenant_id = current_setting('t.venc')::uuid and action = 'tenant.status_changed' and payload ->> 'reason' = 'trial_expired'), 1, 'deja auditoría');
select is((select status from public.tenants where id = current_setting('t.vig')::uuid), 'trialing', 'una prueba vigente no se toca');
select is((select status from public.tenants where id = current_setting('t.stripe')::uuid), 'trialing', 'con suscripción de Stripe no se suspende');
select is((select status from public.tenants where id = current_setting('t.demo')::uuid), 'trialing', 'una demo no se suspende');
select is((select count(*)::int from public.expire_trials()), 0, 'idempotente: la segunda corrida no hace nada');
select is((select count(*)::int from public.audit_log where tenant_id = current_setting('t.venc')::uuid and action = 'tenant.status_changed'), 1, 'y no duplica la auditoría');

-- 2) reset_monthly_quotes
update public.usage set quotes_this_month = 9, month_key = '2000-01' where tenant_id = current_setting('t.act')::uuid;
update public.usage set quotes_this_month = 4, month_key = to_char(now(), 'YYYY-MM') where tenant_id = current_setting('t.vig')::uuid;
select ok(public.reset_monthly_quotes() >= 1, 'reinicia al menos el contador de un mes viejo');
select is((select quotes_this_month || '/' || month_key from public.usage where tenant_id = current_setting('t.act')::uuid), '0/' || to_char(now(), 'YYYY-MM'), 'el mes viejo queda en 0 con el mes actual');
select is((select quotes_this_month from public.usage where tenant_id = current_setting('t.vig')::uuid), 4, 'el contador del mes en curso no se toca');
select is(public.reset_monthly_quotes(), 0, 'idempotente: la segunda corrida no cambia filas');

-- 3) purge_stale_pending_media
insert into public.media (id, tenant_id, kind, r2_key, thumb_key, content_type, bytes, status, created_at) values
  ('00000000-0000-0000-0000-00000000c701', current_setting('t.act')::uuid, 'image', 't/' || current_setting('t.act') || '/_/viejo-full.webp', 't/' || current_setting('t.act') || '/_/viejo-thumb.webp', 'image/webp', 10, 'pending', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-00000000c702', current_setting('t.act')::uuid, 'image', 't/' || current_setting('t.act') || '/_/nuevo-full.webp', null, 'image/webp', 10, 'pending', now() - interval '5 minutes'),
  ('00000000-0000-0000-0000-00000000c703', current_setting('t.act')::uuid, 'image', 't/' || current_setting('t.act') || '/_/listo-full.webp', 't/' || current_setting('t.act') || '/_/listo-thumb.webp', 'image/webp', 10, 'ready', now() - interval '3 days');
select is((select array_agg(r2_key) from public.purge_stale_pending_media()), array['t/' || current_setting('t.act') || '/_/viejo-full.webp'], 'borra solo la reserva pendiente vencida y devuelve su llave');
select is((select count(*)::int from public.media where tenant_id = current_setting('t.act')::uuid), 2, 'la reserva reciente y el medio listo se quedan');
select is((select count(*)::int from public.purge_stale_pending_media()), 0, 'idempotente');
select throws_ok($$select * from public.purge_stale_pending_media(interval '1 minute')$$, '22023', 'invalid_params', 'no acepta un margen menor a 15 minutos');

-- 4) orphan_media_keys
insert into public.items (tenant_id, kind, title, sku, price, images) values
  (current_setting('t.act')::uuid, 'property', 'Casa', 'CR-1', 1, array['https://media.ayx.solutions/t/' || current_setting('t.act') || '/_/legado-full.webp']);
insert into public.quotes (tenant_id, client_name, client_phone, snapshot, expires_at) values
  (current_setting('t.act')::uuid, 'C', '1', jsonb_build_object('property', jsonb_build_object('images', jsonb_build_array('https://media.ayx.solutions/t/' || current_setting('t.act') || '/_/cotizada-full.webp'))), now() + interval '5 days'),
  (current_setting('t.act')::uuid, 'C', '1', jsonb_build_object('property', jsonb_build_object('images', jsonb_build_array('https://media.ayx.solutions/t/' || current_setting('t.act') || '/_/vencida-full.webp'))), now() - interval '5 days');
-- Un ítem de OTRO tenant (p. ej. un clon de demo) usa una llave bajo la ruta de t.act sin fila en media.
insert into public.items (tenant_id, kind, title, sku, price, images) values
  (current_setting('t.vig')::uuid, 'service', 'Clonado', 'CR-2', 1, array['https://media.ayx.solutions/t/' || current_setting('t.act') || '/_/clonada-full.webp']);
select set_config('t.pre', 't/' || current_setting('t.act') || '/_/', true);
select set_config('t.keys', array[
  current_setting('t.pre') || 'listo-full.webp',
  current_setting('t.pre') || 'listo-thumb.webp',
  current_setting('t.pre') || 'nuevo-full.webp',
  current_setting('t.pre') || 'legado-full.webp',
  current_setting('t.pre') || 'legado-thumb.webp',
  current_setting('t.pre') || 'clonada-full.webp',
  current_setting('t.pre') || 'cotizada-full.webp',
  current_setting('t.pre') || 'vencida-full.webp',
  current_setting('t.pre') || 'viejo-full.webp',
  't/00000000-0000-0000-0000-00000000dead/_/x-full.webp',
  't/no-es-uuid/_/x-full.webp',
  'otra-cosa/x.webp'
]::text, true);
select set_eq(
  $$select * from public.orphan_media_keys(current_setting('t.keys')::text[])$$,
  array[
    current_setting('t.pre') || 'vencida-full.webp',
    current_setting('t.pre') || 'viejo-full.webp',
    't/00000000-0000-0000-0000-00000000dead/_/x-full.webp',
    't/no-es-uuid/_/x-full.webp'
  ]::text[],
  'huérfanas: sin fila, sin ítem (de ningún tenant), sin cotización vigente; la miniatura de un -full usado se queda; fuera de t/ no se toca'
);

set local role anon;
select throws_ok($$select * from public.expire_trials()$$, '42501', null, 'anon no vence pruebas');
select throws_ok($$select public.reset_monthly_quotes()$$, '42501', null, 'anon no reinicia contadores');
select throws_ok($$select * from public.purge_stale_pending_media()$$, '42501', null, 'anon no purga medios');
select throws_ok($$select * from public.orphan_media_keys(array['t/x'])$$, '42501', null, 'anon no consulta llaves');
reset role;
set local role authenticated;
select throws_ok($$select * from public.expire_trials()$$, '42501', null, 'authenticated no vence pruebas');
reset role;

select * from finish();
rollback;

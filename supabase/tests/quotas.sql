-- Tests de 0015_quotas.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.local');
select set_config('t.es', public.provision_tenant('00000000-0000-0000-0000-0000000000e1', 'Negocio L', 'negocio-l', 'esencial', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.br', public.provision_tenant('00000000-0000-0000-0000-0000000000e2', 'Negocio M', 'negocio-m', 'broker', 'active', null, 'admin', 'manual')::text, true);

select throws_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'property', 'x')$$, current_setting('t.es')), 'P0001', 'item_quota_exceeded', 'esencial no tiene propiedades');
select lives_ok(format($$insert into public.items (tenant_id, kind, title, sku) values (%L, 'service', 'Servicio', 'S1')$$, current_setting('t.es')), 'esencial sí tiene ítems');

update public.plans set limits = jsonb_set(jsonb_set(limits, '{properties}', '2'), '{items}', '1') where code = 'broker';
insert into public.items (tenant_id, kind, title, sku) values
  (current_setting('t.br')::uuid, 'property', 'P1', 'P1'),
  (current_setting('t.br')::uuid, 'property', 'P2', 'P2');
select throws_ok(format($$insert into public.items (tenant_id, kind, title, sku) values (%L, 'property', 'P3', 'P3')$$, current_setting('t.br')), 'P0001', 'item_quota_exceeded', 'tope de propiedades');
select lives_ok(format($$insert into public.items (tenant_id, kind, title, sku, price) values (%L, 'property', 'P1', 'P1', 5) on conflict (tenant_id, sku) do update set price = excluded.price$$, current_setting('t.br')), 'upsert sobre un sku existente no cuenta como alta');
select lives_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'product', 'Producto')$$, current_setting('t.br')), 'las propiedades no consumen el tope de ítems');
select throws_ok(format($$insert into public.items (tenant_id, kind, title) values (%L, 'service', 'Otro')$$, current_setting('t.br')), 'P0001', 'item_quota_exceeded', 'tope de ítems aparte');

update public.plans set limits = jsonb_set(limits, '{quotes_per_day}', '2') where code = 'broker';
insert into public.quotes (tenant_id, client_name, client_phone, total_amount, discount_pct, down_payment_pct, down_payment_amount, installments_count, monthly_payment_amount, final_payment_amount)
  select current_setting('t.br')::uuid, 'C', '5500000000', 1, 0, 10, 1, 1, 1, 1 from generate_series(1, 2);
select throws_ok(format($$insert into public.quotes (tenant_id, client_name, client_phone, total_amount, discount_pct, down_payment_pct, down_payment_amount, installments_count, monthly_payment_amount, final_payment_amount) values (%L, 'C', '5500000000', 1, 0, 10, 1, 1, 1, 1)$$, current_setting('t.br')), 'P0001', 'quote_quota_exceeded', 'tope diario de cotizaciones');

select is((select count(*)::int from public.reserve_media(current_setting('t.br')::uuid, (select id from public.items where sku = 'P1' and tenant_id = current_setting('t.br')::uuid), 'image', 'image/webp', 100, 10, 10, 10)), 1, 'reserva de medio');
select throws_ok(format($$delete from public.items where tenant_id = %L and sku = 'P1'$$, current_setting('t.br')), '23503', null, 'no se borra un ítem con archivos');
select lives_ok(format($$delete from public.tenants where id = %L$$, current_setting('t.br')), 'borrar el tenant limpia ítems y medios en cascada');

select * from finish();
rollback;

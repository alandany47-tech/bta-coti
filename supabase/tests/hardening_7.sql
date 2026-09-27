-- Tests de 0021_hardening_7.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001401', 'h7-owner@test.local'),
  ('00000000-0000-0000-0000-000000001402', 'h7-prospect@test.local');
select set_config('t.t', public.provision_tenant('00000000-0000-0000-0000-000000001401', 'Negocio H7', 'negocio-h7', 'broker', 'active', null, 'admin', 'manual')::text, true);
insert into public.quotes (tenant_id, client_name, client_phone, snapshot, expires_at)
values (current_setting('t.t')::uuid, 'C', '1', '{}'::jsonb, now() + interval '10 days');
select set_config('t.tok', (select share_token from public.quotes where tenant_id = current_setting('t.t')::uuid), true);

-- 1) get_quote_tenant_slug funciona en una transacción de solo lectura como la de PostgREST para
--    funciones STABLE: ya no es STABLE, así que PostgREST la corre en lectura/escritura.
select is((select provolatile::text from pg_proc where oid = 'public.get_quote_tenant_slug(text)'::regprocedure), 'v', 'get_quote_tenant_slug es VOLATILE');
select is(public.get_quote_tenant_slug(current_setting('t.tok')), 'negocio-h7', 'resuelve el slug de un token válido');

-- 2) service role no comparte el cupo por IP; anon sí queda topado
delete from public.rpc_rate_limit;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', true);
select ok((select bool_and(public.slug_available('libre-h7-' || g)) from generate_series(1, 20) g), 'anon: 20 consultas de slug pasan');
select is(public.slug_available('libre-h7-x'), false, 'anon: la 21.ª se bloquea por IP');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok((select bool_and(public.slug_available('libre-h7-s' || g)) from generate_series(1, 30) g), 'service role (servidor de Next): sin tope por IP de la base');
select is((select count(*)::int from public.get_shared_quote(current_setting('t.tok'))), 1, 'service role lee la cotización compartida');
select set_config('request.jwt.claims', '', true);

-- 3) la demo no pierde fotos ni planos por un usuario con sesión
update public.tenants set is_demo = true where id = current_setting('t.t')::uuid;
insert into public.tenant_members (tenant_id, user_id, role) values (current_setting('t.t')::uuid, '00000000-0000-0000-0000-000000001402', 'editor');
insert into public.items (id, tenant_id, kind, title, sku, price, images, floor_plan_url) values
  ('00000000-0000-0000-0000-00000000ff01', current_setting('t.t')::uuid, 'property', 'Casa', 'H7-1', 1,
   array['https://picsum.photos/a', 'https://picsum.photos/b'], 'https://picsum.photos/plano');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001402","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.items set images = array['https://picsum.photos/b', 'https://picsum.photos/a'] where id = '00000000-0000-0000-0000-00000000ff01'$$, 'demo: reordenar fotos sí se permite');
select throws_ok($$update public.items set images = array['https://picsum.photos/b'] where id = '00000000-0000-0000-0000-00000000ff01'$$, '42501', 'demo_media_locked', 'demo: quitar una foto se bloquea');
select throws_ok($$update public.items set floor_plan_url = null where id = '00000000-0000-0000-0000-00000000ff01'$$, '42501', 'demo_media_locked', 'demo: quitar el plano se bloquea');
select lives_ok($$update public.items set price = 2 where id = '00000000-0000-0000-0000-00000000ff01'$$, 'demo: editar el precio sigue permitido');
reset role;
select set_config('request.jwt.claims', '', true);
update public.tenants set is_demo = false where id = current_setting('t.t')::uuid;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001402","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.items set images = array['https://picsum.photos/b'] where id = '00000000-0000-0000-0000-00000000ff01'$$, 'tenant normal: quitar una foto sí se permite');
reset role;
select set_config('request.jwt.claims', '', true);

-- 4) clone_demo_tenant es atómico
update public.tenants set is_demo = true where id = current_setting('t.t')::uuid;
select set_config('t.c', public.clone_demo_tenant(current_setting('t.t')::uuid, '00000000-0000-0000-0000-000000001402', 'Prospecto H7', 'prospecto-h7', 7)::text, true);
select is((select status from public.tenants where id = current_setting('t.c')::uuid), 'trialing', 'el clon queda en prueba');
select is((select source from public.tenants where id = current_setting('t.c')::uuid), 'demo_clone', 'el clon queda con source demo_clone');
select is((select count(*)::int from public.items where tenant_id = current_setting('t.c')::uuid), 1, 'el clon trae el catálogo');
-- Forzamos que la copia falle (sin cupo de propiedades en el plan): no debe quedar el tenant.
update public.plans set limits = jsonb_set(limits, '{properties}', '0') where code = 'broker';
select throws_ok(format($$select public.clone_demo_tenant(%L, '00000000-0000-0000-0000-000000001402', 'Prospecto H7b', 'prospecto-h7b', 7)$$, current_setting('t.t')), 'P0001', 'item_quota_exceeded', 'si la copia del catálogo falla, el clonado falla');
select is((select count(*)::int from public.tenants where slug = 'prospecto-h7b'), 0, 'y no queda un tenant vacío con el slug ocupado');
select throws_ok(format($$select public.clone_demo_tenant(%L, '00000000-0000-0000-0000-000000001402', 'X', 'prospecto-h7c', 7)$$, current_setting('t.c')), '22023', 'source_not_demo', 'solo se clona un tenant de demo');

set local role anon;
select throws_ok(format($$select public.clone_demo_tenant(%L, '00000000-0000-0000-0000-000000001402', 'X', 'x-h7', 7)$$, current_setting('t.t')), '42501', null, 'anon no clona');
select throws_ok($$select public.rpc_limit_ok('x', 1, 60)$$, '42501', null, 'anon no llama rpc_limit_ok');
reset role;

select * from finish();
rollback;

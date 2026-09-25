-- Tests de 0004_foundation.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- Fixtures (como postgres)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local'),
  ('00000000-0000-0000-0000-00000000000e', 'e@test.local');

select set_config('t.ta',
  public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'Negocio A', 'tenant-a', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.tb',
  public.provision_tenant('00000000-0000-0000-0000-00000000000b', 'Negocio B', 'tenant-b', 'esencial', 'active', null, 'admin', 'manual')::text, true);

insert into public.tenant_members (tenant_id, user_id, role) values
  (current_setting('t.ta')::uuid, '00000000-0000-0000-0000-00000000000c', 'viewer'),
  (current_setting('t.ta')::uuid, '00000000-0000-0000-0000-00000000000e', 'editor');

insert into public.audit_log (tenant_id, action) values (current_setting('t.tb')::uuid, 'test.action');

-- Privilegios de funciones
select is(has_function_privilege('anon', 'public.provision_tenant(uuid,text,text,text,text,int,text,text)', 'execute'), false, 'anon no ejecuta provision_tenant');
select is(has_function_privilege('authenticated', 'public.provision_tenant(uuid,text,text,text,text,int,text,text)', 'execute'), false, 'authenticated no ejecuta provision_tenant');
select is(has_function_privilege('service_role', 'public.provision_tenant(uuid,text,text,text,text,int,text,text)', 'execute'), true, 'service_role ejecuta provision_tenant');

-- slug_available
select is(public.slug_available('libre-slug'), true, 'slug libre disponible');
select is(public.slug_available('admin'), false, 'slug reservado no disponible');
select is(public.slug_available('tenant-a'), false, 'slug existente no disponible');
select is(public.slug_available('AB'), false, 'slug con formato inválido no disponible');

-- provision_tenant
select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'Mi Negocio', 'mi-negocio', 'esencial', 'trialing', 7, 'self_signup');
select is((select status from public.tenants where slug = 'mi-negocio'), 'trialing', 'tenant queda en trialing');
select ok((select trial_ends_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from public.tenants where slug = 'mi-negocio'), 'trial_ends_at = +7 días');
select is((select m.role from public.tenant_members m join public.tenants t on t.id = m.tenant_id where t.slug = 'mi-negocio'), 'owner', 'el dueño queda como owner');
select is((select count(*)::int from public.usage u join public.tenants t on t.id = u.tenant_id where t.slug = 'mi-negocio'), 1, 'se crea la fila de usage');
select is(public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'Mi Negocio', 'mi-negocio', 'esencial', 'trialing', 7, 'self_signup'),
  (select id from public.tenants where slug = 'mi-negocio'), 'idempotente por owner + slug');
select is((select count(*)::int from public.tenants where slug = 'mi-negocio'), 1, 'no duplica tenants');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000b', 'Otro', 'mi-negocio', 'esencial', 'trialing', 7, 'self_signup')$$, '23505', 'slug_taken', 'slug de otro dueño rechazado');

select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'admin', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'reservado rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'ab', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'muy corto rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', '-abc', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'guion inicial rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'a--b', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'doble guion rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'Abc', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'mayúsculas rechazadas');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'abc-', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'guion final rechazado');
select throws_ok(format($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', %L, 'esencial', 'trialing', 7, 'self_signup')$$, repeat('a', 31)), '22023', 'slug_invalid', '31 caracteres rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'plan-malo', 'nope', 'trialing', 7, 'self_signup')$$, '22023', 'plan_not_found', 'plan inexistente rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'plan-trial', 'trial', 'trialing', 7, 'self_signup')$$, '22023', 'plan_not_found', 'plan trial no asignable');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-0000000000ff', 'X', 'sin-dueno', 'esencial', 'trialing', 7, 'self_signup')$$, '23503', 'invalid_owner', 'dueño inexistente rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'estado-malo', 'esencial', 'suspended', 7, 'self_signup')$$, '22023', 'invalid_status', 'estado inválido rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'X', 'sin-dias', 'esencial', 'trialing', 0, 'self_signup')$$, '22023', 'invalid_trial_days', 'trial sin días rechazado');
select public.provision_tenant('00000000-0000-0000-0000-00000000000a', 'Activo', 'activo-uno', 'broker', 'active', null, 'admin', 'manual');
select ok((select trial_ends_at is null from public.tenants where slug = 'activo-uno'), 'active no tiene trial_ends_at');

-- anon
set local role anon;
select throws_ok($$select notes from public.tenants$$, '42501', null, 'anon no lee notes');
select throws_ok($$select stripe_customer_id from public.tenants$$, '42501', null, 'anon no lee stripe_customer_id');
select throws_ok($$select * from public.tenants$$, '42501', null, 'anon no puede select *');
select lives_ok($$select id, name, slug, logo_url, brand_color, status, trial_ends_at, theme, created_at from public.tenants$$, 'anon lee columnas públicas');
select throws_ok($$update public.tenants set name = 'x'$$, '42501', null, 'anon no actualiza tenants');
select throws_ok($$insert into public.tenants (name, slug, plan_id) values ('x', 'xyz', gen_random_uuid())$$, '42501', null, 'anon no inserta tenants');
select throws_ok($$select * from public.tenant_members$$, '42501', null, 'anon no lee tenant_members');
select throws_ok($$select * from public.usage$$, '42501', null, 'anon no lee usage');
select throws_ok($$select * from public.audit_log$$, '42501', null, 'anon no lee audit_log');
select is(public.slug_available('libre-2'), true, 'anon puede llamar slug_available');
select is((select count(*)::int from public.plans), 4, 'anon ve 4 planes públicos');
select is((select count(*)::int from public.plans where code = 'trial'), 0, 'anon no ve el plan trial');
reset role;

-- authenticated: ub (owner de tenant-b)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_member(current_setting('t.ta')::uuid), false, 'b no es miembro de A');
select is(public.is_member(current_setting('t.tb')::uuid, 'owner'), true, 'b es owner de B');
select is((select count(*)::int from public.tenants), 1, 'b solo ve su tenant');
select is((select count(*)::int from public.usage), 1, 'b solo ve su usage');
select is((select count(*)::int from public.tenant_members), 1, 'b solo ve sus membresías');
select is((select count(*)::int from public.audit_log), 0, 'b no ve audit_log');
select throws_ok($$select notes from public.tenants$$, '42501', null, 'authenticated no lee notes');
select throws_ok(format($$insert into public.tenant_members (tenant_id, user_id, role) values (%L, %L, 'owner')$$, current_setting('t.ta'), '00000000-0000-0000-0000-00000000000b'), '42501', null, 'b no se agrega a A');
select is_empty($$update public.tenants set name = 'x' returning id$$, 'b no actualiza tenants por RLS');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-00000000000b', 'X', 'hack-tenant', 'esencial', 'active', null, 'admin')$$, '42501', null, 'authenticated no ejecuta provision_tenant');
reset role;

-- roles: uc viewer, ue editor, ua owner
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_member(current_setting('t.ta')::uuid, 'viewer'), true, 'viewer cumple viewer');
select is(public.is_member(current_setting('t.ta')::uuid, 'editor'), false, 'viewer no cumple editor');
select is(public.is_member(current_setting('t.ta')::uuid, 'owner'), false, 'viewer no cumple owner');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_member(current_setting('t.ta')::uuid, 'editor'), true, 'editor cumple editor');
select is(public.is_member(current_setting('t.ta')::uuid, 'owner'), false, 'editor no cumple owner');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(public.is_member(current_setting('t.ta')::uuid, 'owner'), true, 'owner cumple owner');
reset role;

select * from finish();
rollback;

-- Tests de 0007_signup.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.local');

select set_config('t.t1', public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Panadería Lupita', 'panaderia-lupita', 'esencial', 'trialing', 7, 'self_signup', 'stripe')::text, true);

select is((select status from public.tenants where id = current_setting('t.t1')::uuid), 'trialing', 'registro crea tenant en trialing');
select ok((select trial_ends_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour' from public.tenants where id = current_setting('t.t1')::uuid), 'trial_ends_at = +7 días');
select is((select role from public.tenant_members where tenant_id = current_setting('t.t1')::uuid), 'owner', 'el registrado es owner');
select is((select source from public.tenants where id = current_setting('t.t1')::uuid), 'self_signup', 'source = self_signup');

select is(public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Panadería Lupita', 'panaderia-lupita', 'esencial', 'trialing', 7, 'self_signup', 'stripe')::text, current_setting('t.t1'), 'reintentar el mismo slug es idempotente');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Otro', 'otro-negocio', 'esencial', 'trialing', 7, 'self_signup', 'stripe')$$, '23505', 'trial_used', 'segunda prueba del mismo dueño rechazada');
select lives_ok($$select public.provision_tenant('00000000-0000-0000-0000-0000000000c1', 'Alta admin', 'alta-admin', 'broker', 'active', null, 'admin', 'manual')$$, 'el alta por admin no cuenta como prueba');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-0000000000c2', 'Intruso', 'panaderia-lupita', 'esencial', 'trialing', 7, 'self_signup', 'stripe')$$, '23505', 'slug_taken', 'slug ocupado por otro dueño');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-0000000000c2', 'Banco', 'bbva', 'esencial', 'trialing', 7, 'self_signup', 'stripe')$$, '22023', 'slug_invalid', 'slug de marca bloqueado');

-- tenant suspendido: el dueño ya no escribe por REST
update public.tenants set status = 'suspended' where id = current_setting('t.t1')::uuid;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$insert into public.items (kind, tenant_id, title, sku, price) values ('service', %L, 'x', '1', 1)$$, current_setting('t.t1')), '42501', null, 'tenant suspendido no escribe propiedades');
select throws_ok(format($$insert into public.clients (tenant_id, full_name, phone) values (%L, 'x', '1')$$, current_setting('t.t1')), '42501', null, 'tenant suspendido no crea clientes');
reset role;
update public.tenants set status = 'trialing' where id = current_setting('t.t1')::uuid;
set local role authenticated;
select lives_ok(format($$insert into public.clients (tenant_id, full_name, phone) values (%L, 'x', '1')$$, current_setting('t.t1')), 'tenant en prueba sí escribe');
reset role;

select * from finish();
rollback;

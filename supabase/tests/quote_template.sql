-- Tests de 0034 (plantilla de cotización). Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001401', 'q1@test.local'),
  ('00000000-0000-0000-0000-000000001402', 'q2@test.local'),
  ('00000000-0000-0000-0000-000000001403', 'q3@test.local'),
  ('00000000-0000-0000-0000-000000001404', 'q4@test.local');
select set_config('t.es', public.provision_tenant('00000000-0000-0000-0000-000000001401', 'Esencial Q', 'esencial-q', 'esencial', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.br', public.provision_tenant('00000000-0000-0000-0000-000000001402', 'Broker Q', 'broker-q', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.pro', public.provision_tenant('00000000-0000-0000-0000-000000001404', 'Pro Q', 'pro-q', 'broker_pro', 'active', null, 'admin', 'manual')::text, true);
insert into public.tenant_members (tenant_id, user_id, role) values (current_setting('t.br')::uuid, '00000000-0000-0000-0000-000000001403', 'viewer');

select is((select quote_template from public.tenants where slug = 'esencial-q'), 'clasica', 'default: clásica');

-- esencial (límite 1): solo la primera
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001401","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.set_quote_template(%L, 'clasica')$$, current_setting('t.es')), 'esencial puede usar la clásica');
select throws_ok(format($$select public.set_quote_template(%L, 'moderna')$$, current_setting('t.es')), 'P0001', 'template_not_in_plan', 'esencial no puede usar la moderna');
select throws_ok(format($$select public.set_quote_template(%L, 'premium')$$, current_setting('t.es')), '22023', 'invalid_template', 'código desconocido rechazado');
reset role;

-- broker (límite 3): todas las base
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001402","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.set_quote_template(%L, 'editorial')$$, current_setting('t.br')), 'broker puede usar la editorial');
select is((select quote_template from public.tenants where slug = 'broker-q'), 'editorial', 'queda guardada');
reset role;

-- broker pro (sin límite)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001404","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.set_quote_template(%L, 'moderna')$$, current_setting('t.pro')), 'broker pro sin tope');
reset role;

-- viewer y ajeno
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001403","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.set_quote_template(%L, 'moderna')$$, current_setting('t.br')), 'P0001', 'not_authorized', 'un viewer no cambia la plantilla');
select throws_ok(format($$select public.set_quote_template(%L, 'moderna')$$, current_setting('t.es')), 'P0001', 'not_authorized', 'un ajeno tampoco');
reset role;

set local role anon;
select throws_ok(format($$select public.set_quote_template(%L, 'clasica')$$, current_setting('t.es')), '42501', null, 'anon no puede ejecutarla');
reset role;

select * from finish();
rollback;

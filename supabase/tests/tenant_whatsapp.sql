-- Tests de 0029/0031 (WhatsApp del negocio). Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001201', 'w1@test.local'),
  ('00000000-0000-0000-0000-000000001202', 'w2@test.local');
select set_config('t.a', public.provision_tenant('00000000-0000-0000-0000-000000001201', 'Negocio W', 'negocio-w', 'esencial', 'active', null, 'admin', 'manual')::text, true);

-- w1: dueño
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001201","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.update_tenant_whatsapp(%L, '+52 (55) 1234-5678')$$, current_setting('t.a')), 'guarda el número normalizado a dígitos');
select is((select whatsapp from public.tenants where slug = 'negocio-w'), '525512345678', 'solo quedan los dígitos');
select throws_ok(format($$select public.update_tenant_whatsapp(%L, 'abc')$$, current_setting('t.a')), '22023', 'invalid_whatsapp', 'texto sin dígitos se rechaza (hallazgo de Codex, 0031)');
select throws_ok(format($$select public.update_tenant_whatsapp(%L, '+')$$, current_setting('t.a')), '22023', 'invalid_whatsapp', 'un "+" suelto se rechaza');
select throws_ok(format($$select public.update_tenant_whatsapp(%L, '12345')$$, current_setting('t.a')), '22023', 'invalid_whatsapp', 'muy corto se rechaza');
select is((select whatsapp from public.tenants where slug = 'negocio-w'), '525512345678', 'los rechazos no borran el número guardado');
select lives_ok(format($$select public.update_tenant_whatsapp(%L, '  ')$$, current_setting('t.a')), 'cadena vacía = quitar el número');
select is((select whatsapp from public.tenants where slug = 'negocio-w'), null, 'y entonces sí queda nulo');
reset role;

-- w2: no es miembro
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001202","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.update_tenant_whatsapp(%L, '5512345678')$$, current_setting('t.a')), 'P0001', 'not_authorized', 'un ajeno no cambia el WhatsApp');
reset role;

select * from finish();
rollback;

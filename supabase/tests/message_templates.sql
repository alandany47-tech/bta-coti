-- Tests de 0018_message_templates.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001101', 'g1@test.local'),
  ('00000000-0000-0000-0000-000000001102', 'g2@test.local'),
  ('00000000-0000-0000-0000-000000001103', 'g3@test.local');
select set_config('t.br', public.provision_tenant('00000000-0000-0000-0000-000000001101', 'Negocio P', 'negocio-p', 'broker', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.es', public.provision_tenant('00000000-0000-0000-0000-000000001102', 'Negocio Q', 'negocio-q', 'esencial', 'active', null, 'admin', 'manual')::text, true);
-- El tope de usuarios (0035) se prueba en team.sql; aquí los datos de prueba arman equipos mayores al plan.
alter table public.tenant_members disable trigger tenant_members_users_guard;
insert into public.tenant_members (tenant_id, user_id, role) values (current_setting('t.es')::uuid, '00000000-0000-0000-0000-000000001103', 'viewer');

select is((select array_agg(module order by module) from public.message_templates where tenant_id = current_setting('t.br')::uuid), array['broker', 'services'], 'broker crea plantillas para broker y services');
select is((select array_agg(module order by module) from public.message_templates where tenant_id = current_setting('t.es')::uuid), array['services'], 'esencial solo crea services');
select ok((select body ~ '\{cliente\}' from public.message_templates where tenant_id = current_setting('t.br')::uuid and module = 'broker'), 'la plantilla trae variables sin resolver');

select throws_ok(format($$insert into public.message_templates (tenant_id, module, body) values (%L, 'broker', 'x')$$, current_setting('t.br')), '23505', null, 'ya existe una plantilla broker para ese tenant');
select throws_ok(format($$insert into public.message_templates (tenant_id, module, body) values (%L, 'catalogo', 'x')$$, current_setting('t.br')), '23514', null, 'módulo inválido rechazado');
select throws_ok(format($$update public.message_templates set body = '' where tenant_id = %L and module = 'broker'$$, current_setting('t.br')), '23514', null, 'mensaje vacío rechazado');
select throws_ok(format($$update public.message_templates set body = '<b>hola</b>' where tenant_id = %L and module = 'broker'$$, current_setting('t.br')), '23514', null, 'sin HTML');
select throws_ok(format($$update public.message_templates set body = repeat('a', 1001) where tenant_id = %L and module = 'broker'$$, current_setting('t.br')), '23514', null, 'máximo 1000 caracteres');

set local role anon;
select throws_ok($$select * from public.message_templates$$, '42501', null, 'anon no lee plantillas');
reset role;

-- g1: dueño de t.br
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated"}', true);
set local role authenticated;
select is((select tenant_modules(current_setting('t.br')::uuid)), array['broker', 'services'], 'tenant_modules refleja plans.modules para un miembro');
select is((select tenant_modules(current_setting('t.es')::uuid)), null, 'quien no es miembro no ve los módulos de otro tenant');
select is((select count(*)::int from public.message_templates where tenant_id = current_setting('t.es')::uuid), 0, 'y tampoco sus plantillas');
reset role;

-- g3: viewer de t.es
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001103","role":"authenticated"}', true);
set local role authenticated;
select is((select body from public.message_templates where tenant_id = current_setting('t.es')::uuid), public.default_message_template('services'), 'viewer sí lee la plantilla de su propio tenant');
select is_empty(format($$update public.message_templates set body = 'Hola {cliente}' where tenant_id = %L returning tenant_id$$, current_setting('t.es')), 'viewer no edita la plantilla');
reset role;

-- g1: editor (dueño) de t.br
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001101","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$update public.message_templates set body = 'Hola {cliente}, tu total es {total}.' where tenant_id = %L and module = 'broker'$$, current_setting('t.br')), 'editor sí actualiza su plantilla');
select throws_ok(format($$update public.message_templates set tenant_id = %L where tenant_id = %L and module = 'broker'$$, current_setting('t.es'), current_setting('t.br')), '42501', 'tenant_id_immutable', 'no se puede mover una plantilla de tenant');
select throws_ok(format($$insert into public.message_templates (tenant_id, module, body) values (%L, 'catalog', 'Hola')$$, current_setting('t.br')), '42501', null, 'un editor no crea plantillas nuevas (solo el servidor al aprovisionar)');
reset role;

select * from finish();
rollback;

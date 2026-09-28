-- Tests de 0005_antiabuse.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'u1@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'u2@mailinator.com'),
  ('00000000-0000-0000-0000-000000000003', 'u3@bbva-seguridad.com'),
  ('00000000-0000-0000-0000-000000000004', 'u4@gmail.com');

-- normalize_slug
select is(public.normalize_slug('Sántánder'), 'santander', 'normaliza acentos');
select is(public.normalize_slug('b-b-v-4'), 'bbva', 'normaliza guiones y leetspeak');
select is(public.normalize_slug('$@t'), 'sat', 'normaliza $ y @');

-- slugs bloqueados (marcas, gobierno, keywords, difusos, reservados)
select is(public.slug_available(s), false, 'bloqueado: ' || s)
from unnest(array['bbva','bbva-pagos','s4ntander','banortte','banortte-pagos','paypa1','gmai1','santandr',
                  'login-seguro','micuenta','sat','hsbc','app','a-p-i','admin']) as s;

-- slugs permitidos
select is(public.is_slug_blocked(s), false, 'permitido: ' || s)
from unnest(array['panaderia-lupita','torrezafiro','taqueria-el-sol','inmobiliaria-lopez','mi-negocio','estudio-garcia']) as s;
select is(public.slug_available('panaderia-lupita'), true, 'panaderia-lupita disponible');

-- allowlist: gana sobre marcas pero no sobre reservados
select is(public.is_slug_blocked('metalurgica-mx'), true, 'metalurgica-mx bloqueado por contener meta');
insert into public.blocked_terms_allow (slug, reason) values ('metalurgica-mx', 'test'), ('admin', 'test');
select is(public.is_slug_blocked('metalurgica-mx'), false, 'allowlist libera metalurgica-mx');
select is(public.is_slug_blocked('admin'), true, 'allowlist no libera reservados');

-- provision_tenant bloquea igual que slug_available
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'X', 'bbva-pagos', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'provision bloquea bbva-pagos');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'X', 's4ntander', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'provision bloquea s4ntander');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'X', 'login-seguro', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'slug_invalid', 'provision bloquea login-seguro');
select lives_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'Panadería Lupita', 'panaderia-lupita', 'esencial', 'trialing', 7, 'self_signup')$$, 'provision acepta panaderia-lupita');
select is((select flagged from public.tenants where slug = 'panaderia-lupita'), false, 'nombre normal no queda flagged');

-- nombre con marca: se registra, queda flagged
select public.provision_tenant('00000000-0000-0000-0000-000000000004', 'BBVA Pagos', 'pagos-rapidos', 'esencial', 'trialing', 7, 'self_signup');
select is((select flagged from public.tenants where slug = 'pagos-rapidos'), true, 'nombre con marca queda flagged');

-- dominio de correo con marca: flagged; gmail no
select public.provision_tenant('00000000-0000-0000-0000-000000000003', 'Cliente Uno', 'cliente-uno', 'esencial', 'active', null, 'admin', 'manual');
select is((select flagged from public.tenants where slug = 'cliente-uno'), true, 'dominio de correo con marca queda flagged');
select public.provision_tenant('00000000-0000-0000-0000-000000000004', 'Estudio Garcia', 'estudio-garcia', 'esencial', 'active', null, 'admin', 'manual');
select is((select flagged from public.tenants where slug = 'estudio-garcia'), false, 'gmail no marca flagged');

-- correos desechables
select is(public.is_disposable_email('a@mailinator.com'), true, 'mailinator es desechable');
select is(public.is_disposable_email('a@sub.mailinator.com'), true, 'subdominio desechable');
select is(public.is_disposable_email('a@gmail.com'), false, 'gmail no es desechable');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000002', 'Negocio Dos', 'negocio-dos', 'esencial', 'trialing', 7, 'self_signup')$$, '22023', 'email_disposable', 'self_signup rechaza desechable');
select lives_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000002', 'Negocio Dos', 'negocio-dos', 'esencial', 'active', null, 'admin', 'manual')$$, 'alta de admin acepta desechable');

-- privilegios
select is(has_function_privilege('anon', 'public.is_slug_blocked(text)', 'execute'), false, 'anon no ejecuta is_slug_blocked');
select is(has_function_privilege('authenticated', 'public.is_text_flagged(text)', 'execute'), false, 'authenticated no ejecuta is_text_flagged');
select is(has_function_privilege('anon', 'public.slug_available(text)', 'execute'), true, 'anon ejecuta slug_available');
select is(has_function_privilege('anon', 'public.is_disposable_email(text)', 'execute'), true, 'anon ejecuta is_disposable_email');
select is(has_function_privilege('anon', 'public.provision_tenant(uuid,text,text,text,text,int,text,text)', 'execute'), false, 'anon no ejecuta provision_tenant');

set local role anon;
select throws_ok($$select * from public.blocked_terms$$, '42501', null, 'anon no lee blocked_terms');
select throws_ok($$select * from public.blocked_terms_allow$$, '42501', null, 'anon no lee blocked_terms_allow');
select throws_ok($$select * from public.disposable_email_domains$$, '42501', null, 'anon no lee disposable_email_domains');
select is(public.slug_available('bbva-pagos'), false, 'anon: slug_available bloquea bbva-pagos por RPC directo');
select is(public.slug_available('taqueria-el-sol'), true, 'anon: slug_available permite taqueria-el-sol');
reset role;

-- correcciones de 0004
select is(public.is_slug_valid('a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t'), false, 'slug con guiones de más de 30 caracteres rechazado');
select is(public.is_slug_valid(repeat('a', 30)), true, '30 caracteres válido');
select is(public.slug_available('a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t'), false, 'slug_available rechaza slug largo');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'X', 'origen-nulo', 'esencial', 'active', null, null)$$, '22023', 'invalid_source', 'source nulo rechazado');
select throws_ok($$select public.provision_tenant('00000000-0000-0000-0000-000000000001', 'X', 'estado-nulo', 'esencial', null, null, 'admin')$$, '22023', 'invalid_status', 'status nulo rechazado');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(public.is_member((select id from public.tenants where slug = 'panaderia-lupita'), 'owner'), true, 'is_member owner válido');
select is(public.is_member((select id from public.tenants where slug = 'panaderia-lupita'), 'Owner'), false, 'is_member con rol desconocido es falso');

select * from finish();
rollback;

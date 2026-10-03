-- Tests de 0035 (usuarios extra). Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000001501', 'dueno@test.local'),
  ('00000000-0000-0000-0000-000000001502', 'nuevo@test.local'),
  ('00000000-0000-0000-0000-000000001503', 'otro@test.local'),
  ('00000000-0000-0000-0000-000000001504', 'esencial@test.local'),
  ('00000000-0000-0000-0000-000000001505', 'tercero@test.local');
select set_config('t.cat', public.provision_tenant('00000000-0000-0000-0000-000000001501', 'Catalogo T', 'catalogo-t', 'catalogo', 'active', null, 'admin', 'manual')::text, true);
select set_config('t.es', public.provision_tenant('00000000-0000-0000-0000-000000001504', 'Esencial T', 'esencial-t', 'esencial', 'active', null, 'admin', 'manual')::text, true);

-- hashes de prueba (64 caracteres)
select set_config('h.a', repeat('a', 64), true);
select set_config('h.b', repeat('b', 64), true);
select set_config('h.c', repeat('c', 64), true);

-- ---- esencial: límite 1 → no se puede invitar a nadie
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001504","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.create_invitation(%L, 'x@test.local', 'viewer', %L)$$, current_setting('t.es'), current_setting('h.a')), 'P0001', 'user_quota_exceeded', 'esencial (1 usuario) no puede invitar');
reset role;

-- ---- catálogo: límite 2
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated"}', true);
set local role authenticated;
select ok(public.create_invitation(current_setting('t.cat')::uuid, '  Nuevo@Test.Local ', 'viewer', current_setting('h.a')) > now(), 'invita (correo normalizado) y devuelve la vigencia');
select throws_ok(format($$select public.create_invitation(%L, 'otro@test.local', 'editor', %L)$$, current_setting('t.cat'), current_setting('h.b')), 'P0001', 'user_quota_exceeded', 'dueño + 1 invitación vigente llenan el plan de 2');
select lives_ok(format($$select public.create_invitation(%L, 'nuevo@test.local', 'editor', %L)$$, current_setting('t.cat'), current_setting('h.c')), 'reinvitar el mismo correo reemplaza la anterior (no cuenta doble)');
select throws_ok(format($$select public.create_invitation(%L, 'nuevo@test.local', 'owner', %L)$$, current_setting('t.cat'), current_setting('h.a')), '22023', 'invalid_role', 'no se invita como dueño');
select throws_ok(format($$select public.create_invitation(%L, 'sin-arroba', 'viewer', %L)$$, current_setting('t.cat'), current_setting('h.a')), '22023', 'invalid_email', 'correo inválido');
select throws_ok(format($$select public.create_invitation(%L, 'dueno@test.local', 'viewer', %L)$$, current_setting('t.cat'), current_setting('h.a')), 'P0001', 'already_member', 'no se invita a quien ya es miembro');
select is((select jsonb_array_length(public.team_overview(current_setting('t.cat')::uuid)->'invitations')), 1, 'solo queda una invitación vigente (la reemplazada se revocó)');
select is((public.team_overview(current_setting('t.cat')::uuid)->>'limit')::int, 2, 'team_overview informa el límite');
reset role;

-- ---- aceptar (solo servidor)
select is((select role from public.tenant_invitations where token_hash = current_setting('h.c')), 'editor', 'la vigente es la del rol nuevo');
select throws_ok(format($$select public.accept_invitation(%L, '00000000-0000-0000-0000-000000001503')$$, current_setting('h.c')), 'P0001', 'email_mismatch', 'un correo distinto no puede aceptarla');
select throws_ok(format($$select public.accept_invitation(%L, '00000000-0000-0000-0000-000000001502')$$, current_setting('h.a')), 'P0001', 'invitation_invalid', 'la invitación reemplazada ya no sirve');
select is(public.accept_invitation(current_setting('h.c'), '00000000-0000-0000-0000-000000001502'), 'catalogo-t', 'aceptar crea la membresía y devuelve el subdominio');
select is((select role from public.tenant_members where tenant_id = current_setting('t.cat')::uuid and user_id = '00000000-0000-0000-0000-000000001502'), 'editor', 'con el rol invitado');
select throws_ok(format($$select public.accept_invitation(%L, '00000000-0000-0000-0000-000000001502')$$, current_setting('h.c')), 'P0001', 'invitation_invalid', 'un token no se usa dos veces');
select throws_ok(format($$insert into public.tenant_members (tenant_id, user_id, role) values (%L, '00000000-0000-0000-0000-000000001505', 'viewer')$$, current_setting('t.cat')), 'P0001', 'user_quota_exceeded', 'el trigger bloquea al superar limits.users');


-- ---- gestión de roles (dueño)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.set_member_role(%L, '00000000-0000-0000-0000-000000001502', 'viewer')$$, current_setting('t.cat')), 'el dueño cambia el rol de un miembro');
select throws_ok(format($$select public.set_member_role(%L, '00000000-0000-0000-0000-000000001501', 'viewer')$$, current_setting('t.cat')), 'P0001', 'cannot_modify_owner', 'no se degrada al dueño');
select throws_ok(format($$select public.set_member_role(%L, '00000000-0000-0000-0000-000000001502', 'owner')$$, current_setting('t.cat')), '22023', 'invalid_role', 'no se asciende a dueño');
select throws_ok(format($$select public.remove_member(%L, '00000000-0000-0000-0000-000000001501')$$, current_setting('t.cat')), 'P0001', 'cannot_modify_owner', 'el dueño no se quita a sí mismo');
reset role;

-- ---- el miembro no administra el equipo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001502","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(format($$select public.team_overview(%L)$$, current_setting('t.cat')), 'P0001', 'not_authorized', 'un viewer no ve el equipo');
select throws_ok(format($$select public.create_invitation(%L, 'z@test.local', 'viewer', %L)$$, current_setting('t.cat'), current_setting('h.a')), 'P0001', 'not_authorized', 'ni invita');
select throws_ok(format($$select public.remove_member(%L, '00000000-0000-0000-0000-000000001501')$$, current_setting('t.cat')), 'P0001', 'not_authorized', 'ni quita');
select throws_ok(format($$select public.accept_invitation(%L, '00000000-0000-0000-0000-000000001502')$$, current_setting('h.c')), '42501', null, 'accept_invitation no es ejecutable con sesión');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001501","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(format($$select public.remove_member(%L, '00000000-0000-0000-0000-000000001502')$$, current_setting('t.cat')), 'el dueño quita a un miembro');
select is((select count(*)::int from public.tenant_members where tenant_id = current_setting('t.cat')::uuid), 1, 'y queda solo el dueño');
reset role;

-- ---- caducidad
update public.tenant_invitations set expires_at = now() - interval '1 minute' where token_hash = current_setting('h.c');
select is((select status from public.invitation_preview(current_setting('h.b'))), null, 'un token inexistente no devuelve nada');

-- ---- demo: sin tope ni gestión
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000001504","role":"authenticated"}', true);
update public.tenants set is_demo = true where id = current_setting('t.es')::uuid;
select lives_ok(format($$insert into public.tenant_members (tenant_id, user_id, role) values (%L, '00000000-0000-0000-0000-000000001505', 'viewer')$$, current_setting('t.es')), 'los tenants de demo quedan fuera del tope');
set local role authenticated;
select throws_ok(format($$select public.create_invitation(%L, 'z@test.local', 'viewer', %L)$$, current_setting('t.es'), current_setting('h.a')), '42501', 'demo_readonly', 'en demo no se invita');
reset role;

select * from finish();
rollback;

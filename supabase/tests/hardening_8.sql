-- Tests de 0023_hardening_8.sql. Correr con: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

-- p_ip (0021) se revirtió: nadie puede pasar su propia llave de límite. Si alguien la reintroduce
-- por error, esta prueba lo agarra (la llamada con 2 argumentos ya no debe resolver a nada).
select throws_ok($$select public.slug_available('negocio-cualquiera', '1.2.3.4')$$, '42883', null, 'slug_available ya no acepta p_ip');
select throws_ok($$select public.get_shared_quote('x'::text, '1.2.3.4'::text)$$, '42883', null, 'get_shared_quote ya no acepta p_ip');
select throws_ok($$select public.get_quote_tenant_slug('x'::text, '1.2.3.4'::text)$$, '42883', null, 'get_quote_tenant_slug ya no acepta p_ip');

-- siguen funcionando con un solo argumento
select lives_ok($$select public.slug_available('negocio-hardening-8')$$, 'slug_available con un argumento sigue viva');
select lives_ok($$select public.get_shared_quote('0000000000000000000000000000000000')$$, 'get_shared_quote con un argumento sigue viva');
select lives_ok($$select public.get_quote_tenant_slug('0000000000000000000000000000000000')$$, 'get_quote_tenant_slug con un argumento sigue viva');

select * from finish();
rollback;

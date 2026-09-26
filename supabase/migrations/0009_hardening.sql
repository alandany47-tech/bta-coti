-- Endurecimiento tras la revisión de Codex de T00–T03:
-- 1) past_due conserva acceso de escritura (periodo de gracia, AUTH-ONBOARDING §5).
-- 2) Los slugs reservados no se pueden liberar con la allowlist.
-- 3) Las URLs de medios que escribe un usuario deben ser de su carpeta de Storage
--    (react-pdf las descarga en el servidor: sin esto es un SSRF).
-- 4) Los buckets rechazan tipos y tamaños inválidos aunque se suba directo a Storage.

-- ============================================================
-- 1) can_write
-- ============================================================
create or replace function public.can_write(p_tenant_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_member(p_tenant_id, p_min_role)
    and exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.status in ('active', 'trialing', 'past_due')
    );
$$;

-- ============================================================
-- 2) Reservados fijos (DATA-MODEL): no dependen de blocked_terms ni de la allowlist
-- ============================================================
create or replace function public.is_slug_reserved(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select p_slug = any (array[
    'www','app','admin','api','media','cdn','panel','login','registro','mail',
    'soporte','ayuda','blog','status','docs','stripe','test','demo'
  ])
  or exists (
    select 1 from public.blocked_terms b where b.kind = 'reserved' and b.term = p_slug
  );
$$;

revoke execute on function public.is_slug_reserved(text) from public, anon, authenticated;
grant execute on function public.is_slug_reserved(text) to service_role;

create or replace function public.is_slug_blocked(p_slug text)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_slug text := lower(coalesce(p_slug, ''));
  v_forms text[];
begin
  if v_slug = '' or public.is_slug_reserved(v_slug) then
    return true;
  end if;
  v_forms := public._slug_forms(v_slug);

  if exists (
    select 1 from public.blocked_terms b
    where b.kind = 'reserved' and (b.term = v_slug or b.term = any (v_forms))
  ) then
    return true;
  end if;

  if exists (select 1 from public.blocked_terms_allow a where a.slug = v_slug) then
    return false;
  end if;

  return public._terms_hit(v_forms);
end;
$$;

-- ============================================================
-- 3) properties: URLs de medios solo de la carpeta del tenant
-- ============================================================
create or replace function public.properties_media_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pattern text := '^https://[a-z0-9]{10,30}\.supabase\.co/storage/v1/object/public/property-media/'
    || new.tenant_id::text || '/[^[:space:]]+$';
  v_url text;
begin
  -- Solo restringe a usuarios con sesión; la service role (admin, importaciones) queda fuera.
  if current_user <> 'authenticated' then
    return new;
  end if;

  for v_url in
    select u from unnest(coalesce(new.images, '{}')) u
    where tg_op = 'INSERT' or not (u = any (coalesce(old.images, '{}')))
  loop
    if v_url !~ v_pattern or v_url ~* '(\.\.|%2e)' then
      raise exception 'invalid_media_url' using errcode = '22023';
    end if;
  end loop;

  if new.floor_plan_url is not null
     and (tg_op = 'INSERT' or new.floor_plan_url is distinct from old.floor_plan_url)
     and (new.floor_plan_url !~ v_pattern or new.floor_plan_url ~* '(\.\.|%2e)') then
    raise exception 'invalid_media_url' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger properties_media_guard
  before insert or update on public.properties
  for each row execute function public.properties_media_guard();

-- ============================================================
-- 4) Buckets: tipo y tamaño en el límite de Storage
-- ============================================================
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'property-media';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf']
where id = 'quotes';

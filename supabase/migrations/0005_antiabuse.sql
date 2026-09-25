-- T18 — Antiabuso (docs/ABUSE-AND-LIMITS.md §3–§4, D18)
-- Bloqueo de slugs de phishing (marcas, gobierno, keywords) con el mismo
-- resultado en slug_available y provision_tenant, marca de nombres
-- sospechosos y rechazo de correos desechables.

create extension if not exists fuzzystrmatch with schema extensions;

-- ============================================================
-- Correcciones de 0004
-- ============================================================
-- El patrón cuenta bloques de 1 o 2 caracteres: sin este límite pasaban slugs de hasta 59.
create or replace function public.is_slug_valid(p_slug text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    p_slug ~ '^[a-z0-9](-?[a-z0-9]){2,29}$' and length(p_slug) between 3 and 30,
    false
  );
$$;

-- Un rol mínimo desconocido ('Owner', 'admin') ya no cae en viewer: el resultado es falso.
create or replace function public.is_member(p_tenant_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case m.role when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 end
      >= case p_min_role when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 end
    from public.tenant_members m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid()
  ), false);
$$;

-- ============================================================
-- Tablas (sin acceso para anon/authenticated; solo service role y funciones definer)
-- ============================================================
create table public.blocked_terms (
  term text primary key,
  kind text not null check (kind in ('reserved', 'brand', 'keyword')),
  created_at timestamptz not null default now()
);

create table public.blocked_terms_allow (
  slug text primary key,
  tenant_id uuid references public.tenants (id) on delete set null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.disposable_email_domains (
  domain text primary key,
  added_at timestamptz not null default now()
);

alter table public.blocked_terms enable row level security;
alter table public.blocked_terms_allow enable row level security;
alter table public.disposable_email_domains enable row level security;

revoke all on public.blocked_terms, public.blocked_terms_allow, public.disposable_email_domains
  from anon, authenticated;

-- ============================================================
-- Normalización
-- ============================================================
-- Minúsculas, sin acentos, leetspeak a letras y solo [a-z0-9].
create or replace function public.normalize_slug(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    translate(
      lower(coalesce(p_text, '')),
      'áàäâãéèëêíìïîóòöôõúùüûñç0134578@$',
      'aaaaaeeeeiiiiooooouuuuncoieastbas'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

-- Formas a revisar: normal, variante 1→l, y ambas con letras repetidas colapsadas.
create or replace function public._slug_forms(p_text text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select array(
    select distinct f from unnest(array[
      public.normalize_slug(p_text),
      public.normalize_slug(replace(lower(coalesce(p_text, '')), '1', 'l')),
      regexp_replace(public.normalize_slug(p_text), '(.)\1+', '\1', 'g'),
      regexp_replace(public.normalize_slug(replace(lower(coalesce(p_text, '')), '1', 'l')), '(.)\1+', '\1', 'g')
    ]) as f
    where f <> ''
  );
$$;

-- ============================================================
-- Seed de términos (se guardan normalizados)
-- ============================================================
insert into public.blocked_terms (term, kind)
select public.normalize_slug(t), k
from (values
  ('www','reserved'),('app','reserved'),('admin','reserved'),('api','reserved'),('media','reserved'),
  ('cdn','reserved'),('panel','reserved'),('registro','reserved'),('mail','reserved'),('soporte','reserved'),
  ('ayuda','reserved'),('blog','reserved'),('status','reserved'),('docs','reserved'),('test','reserved'),
  ('demo','reserved'),
  ('bbva','brand'),('banorte','brand'),('santander','brand'),('banamex','brand'),('citibanamex','brand'),
  ('hsbc','brand'),('scotiabank','brand'),('inbursa','brand'),('azteca','brand'),('banregio','brand'),
  ('afirme','brand'),('bancoppel','brand'),('banbajio','brand'),('nubank','brand'),('spin','brand'),
  ('mercadopago','brand'),('paypal','brand'),('stripe','brand'),('clip','brand'),('openpay','brand'),
  ('sat','brand'),('imss','brand'),('infonavit','brand'),('fovissste','brand'),('cfe','brand'),
  ('condusef','brand'),('gob','brand'),('gobierno','brand'),('curp','brand'),('renapo','brand'),
  ('apple','brand'),('icloud','brand'),('google','brand'),('gmail','brand'),('microsoft','brand'),
  ('outlook','brand'),('office365','brand'),('amazon','brand'),('netflix','brand'),('facebook','brand'),
  ('instagram','brand'),('whatsapp','brand'),('meta','brand'),('tiktok','brand'),('spotify','brand'),
  ('oxxo','brand'),('coppel','brand'),('liverpool','brand'),('walmart','brand'),('elektra','brand'),
  ('mercadolibre','brand'),('dhl','brand'),('fedex','brand'),('estafeta','brand'),
  ('login','keyword'),('signin','keyword'),('verify','keyword'),('verificar','keyword'),('secure','keyword'),
  ('seguro','keyword'),('cuenta','keyword'),('account','keyword'),('password','keyword'),('contrasena','keyword'),
  ('recovery','keyword'),('recuperar','keyword'),('wallet','keyword'),('factura-sat','keyword'),('token','keyword'),
  ('auth','keyword'),('sso','keyword'),('soporte-tecnico','keyword'),('desbloqueo','keyword')
) as v(t, k)
on conflict (term) do nothing;

-- Punto de partida; scripts/sync-disposable-domains.ts carga la lista completa.
insert into public.disposable_email_domains (domain) values
  ('mailinator.com'),('guerrillamail.com'),('10minutemail.com'),('tempmail.com'),('temp-mail.org'),
  ('yopmail.com'),('trashmail.com'),('getnada.com'),('sharklasers.com'),('throwawaymail.com'),
  ('maildrop.cc'),('dispostable.com'),('fakeinbox.com'),('mintemail.com'),('mohmal.com')
on conflict do nothing;

-- ============================================================
-- Reservados y bloqueo de slugs
-- ============================================================
create or replace function public.is_slug_reserved(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_terms b where b.kind = 'reserved' and b.term = p_slug
  );
$$;

-- Marcas, keywords y coincidencias difusas contra las formas normalizadas.
create or replace function public._terms_hit(p_forms text[])
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  f text;
  t text;
  w int;
  i int;
begin
  foreach f in array p_forms loop
    if exists (
      select 1 from public.blocked_terms b
      where (b.kind = 'keyword' and position(b.term in f) > 0)
         or (b.kind = 'brand' and (
              (length(b.term) >= 4 and position(b.term in f) > 0)
              or (length(b.term) < 4 and b.term = f)))
    ) then
      return true;
    end if;

    -- Levenshtein <= 1 contra el slug completo (términos de 5+ letras) y, para
    -- términos de 7+ letras, contra ventanas del slug (p. ej. banortte-pagos).
    -- Con términos cortos las ventanas dan falsos positivos (email ~ gmail).
    for t in select b.term from public.blocked_terms b where b.kind = 'brand' and length(b.term) >= 5 loop
      if extensions.levenshtein(f, t) <= 1 then
        return true;
      end if;
      if length(t) >= 7 then
        for w in (length(t) - 1) .. (length(t) + 1) loop
          for i in 1 .. greatest(length(f) - w + 1, 0) loop
            if extensions.levenshtein(substr(f, i, w), t) <= 1 then
              return true;
            end if;
          end loop;
        end loop;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;

-- La allowlist gana sobre marcas, keywords y difusos, nunca sobre reservados.
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
  if v_slug = '' then
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

-- Nombre del negocio (o dominio del correo): solo marca, no bloquea.
create or replace function public.is_text_flagged(p_text text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public._terms_hit(public._slug_forms(p_text));
$$;

create or replace function public.is_disposable_email(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.disposable_email_domains d
    where lower(split_part(coalesce(p_email, ''), '@', 2)) = d.domain
       or lower(split_part(coalesce(p_email, ''), '@', 2)) like '%.' || d.domain
  );
$$;

-- ============================================================
-- Integración: slug_available y provision_tenant
-- ============================================================
create or replace function public.slug_available(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_slug_valid(p_slug)
    and not public.is_slug_blocked(p_slug)
    and not exists (select 1 from public.tenants t where t.slug = p_slug);
$$;

create or replace function public.provision_tenant(
  p_owner uuid,
  p_name text,
  p_slug text,
  p_plan_code text,
  p_status text,
  p_trial_days int,
  p_source text,
  p_billing_mode text default 'stripe'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_tenant_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text;
  v_domain text;
  v_flagged boolean;
begin
  if p_owner is null or v_name = '' then
    raise exception 'invalid_params' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('trialing', 'active') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status = 'trialing' and coalesce(p_trial_days, 0) <= 0 then
    raise exception 'invalid_trial_days' using errcode = '22023';
  end if;
  if p_source is null or p_source not in ('self_signup', 'admin', 'demo_clone') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;
  if p_billing_mode is null or p_billing_mode not in ('stripe', 'manual') then
    raise exception 'invalid_billing_mode' using errcode = '22023';
  end if;
  if not public.is_slug_valid(p_slug) or public.is_slug_blocked(p_slug) then
    raise exception 'slug_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('provision_tenant:' || p_slug));

  select t.id into v_tenant_id from public.tenants t where t.slug = p_slug;
  if v_tenant_id is not null then
    if exists (
      select 1 from public.tenant_members m
      where m.tenant_id = v_tenant_id and m.user_id = p_owner and m.role = 'owner'
    ) then
      return v_tenant_id;
    end if;
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  select u.email into v_email from auth.users u where u.id = p_owner;
  if not found then
    raise exception 'invalid_owner' using errcode = '23503';
  end if;

  if p_source = 'self_signup' and public.is_disposable_email(v_email) then
    raise exception 'email_disposable' using errcode = '22023';
  end if;

  select id into v_plan_id from public.plans where code = p_plan_code and code <> 'trial';
  if v_plan_id is null then
    raise exception 'plan_not_found' using errcode = '22023';
  end if;

  -- Dominios de correo de consumo: contienen marcas (gmail, outlook, icloud) sin ser phishing.
  v_domain := lower(split_part(coalesce(v_email, ''), '@', 2));
  v_flagged := public.is_text_flagged(v_name)
    or (v_domain <> ''
        and v_domain <> all (array['gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','yahoo.com','yahoo.com.mx','proton.me','protonmail.com'])
        and public.is_text_flagged(split_part(v_domain, '.', 1)));

  insert into public.tenants (name, slug, plan_id, status, trial_ends_at, billing_mode, source, flagged)
  values (
    v_name, p_slug, v_plan_id, p_status,
    case when p_status = 'trialing' then now() + make_interval(days => p_trial_days) end,
    p_billing_mode, p_source, v_flagged
  )
  returning id into v_tenant_id;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_tenant_id, p_owner, 'owner');

  insert into public.usage (tenant_id) values (v_tenant_id);

  return v_tenant_id;
end;
$$;

-- ============================================================
-- Privilegios de ejecución
-- ============================================================
revoke execute on function public._slug_forms(text) from public, anon, authenticated;
revoke execute on function public._terms_hit(text[]) from public, anon, authenticated;
revoke execute on function public.is_slug_blocked(text) from public, anon, authenticated;
revoke execute on function public.is_text_flagged(text) from public, anon, authenticated;
revoke execute on function public.is_slug_reserved(text) from public, anon, authenticated;
grant execute on function public._slug_forms(text) to service_role;
grant execute on function public._terms_hit(text[]) to service_role;
grant execute on function public.is_slug_blocked(text) to service_role;
grant execute on function public.is_text_flagged(text) to service_role;
grant execute on function public.is_slug_reserved(text) to service_role;

revoke execute on function public.is_disposable_email(text) from public;
grant execute on function public.is_disposable_email(text) to anon, authenticated, service_role;

revoke execute on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated, service_role;

revoke execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  to service_role;

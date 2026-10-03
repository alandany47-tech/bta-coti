-- T33 — Usuarios extra: invitaciones, roles y tope por plan (`plans.limits.users`).
-- Roles (ya existían en tenant_members): owner (uno, administra el equipo), editor (edita catálogo,
-- plantillas, mensajes y cotiza) y viewer (solo cotiza). Quien invita es siempre el dueño.
--
-- Flujo: el dueño crea una invitación (token aleatorio; aquí solo se guarda su hash SHA-256), la app
-- manda el correo y quien la recibe la acepta en /invitacion/<token> (con cuenta nueva o ya existente).
-- Sin cuenta, la membresía NO se crea hasta que acepta: así el tope cuenta miembros + invitaciones vigentes
-- al invitar, y el trigger de abajo es el respaldo duro al aceptar.

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) <= 254),
  role text not null check (role in ('editor', 'viewer')),
  token_hash text not null unique,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz
);
create unique index tenant_invitations_pending_idx
  on public.tenant_invitations (tenant_id, email) where accepted_at is null and revoked_at is null;

-- Sin políticas: solo las funciones de abajo (security definer) y la llave de servicio lo tocan.
alter table public.tenant_invitations enable row level security;
revoke all on public.tenant_invitations from anon, authenticated;

-- ---------------------------------------------------------------- tope de usuarios (trigger)
-- Cuenta solo miembros. En prueba manda el tope de `plans.trial` (1 usuario): effective_limit ya lo hace.
-- Los tenants de demo quedan fuera (reset_demo_data crea 3 usuarios en un plan de 2).
create or replace function public.tenant_members_users_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
begin
  if exists (select 1 from public.tenants t where t.id = new.tenant_id and t.is_demo) then
    return new;
  end if;
  v_limit := public.effective_limit(new.tenant_id, 'users');
  if v_limit is not null
     and (select count(*) from public.tenant_members m where m.tenant_id = new.tenant_id) >= v_limit then
    raise exception 'user_quota_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tenant_members_users_guard
  before insert on public.tenant_members
  for each row execute function public.tenant_members_users_guard();

-- ---------------------------------------------------------------- vista del equipo (solo dueño)
create or replace function public.team_overview(p_tenant uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_member(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;
  return jsonb_build_object(
    'limit', public.effective_limit(p_tenant, 'users'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', u.email, 'role', m.role, 'created_at', m.created_at, 'last_sign_in_at', u.last_sign_in_at
      ) order by case m.role when 'owner' then 0 when 'editor' then 1 else 2 end, m.created_at)
      from public.tenant_members m join auth.users u on u.id = m.user_id
      where m.tenant_id = p_tenant
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'email', i.email, 'role', i.role, 'created_at', i.created_at, 'expires_at', i.expires_at
      ) order by i.created_at)
      from public.tenant_invitations i
      where i.tenant_id = p_tenant and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------- invitar (reemplaza la pendiente del mismo correo)
create or replace function public.create_invitation(p_tenant uuid, p_email text, p_role text, p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_limit bigint;
  v_taken bigint;
  v_expires timestamptz;
begin
  if not public.can_write(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant and t.is_demo) then
    raise exception 'demo_readonly' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.tenant_members m join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant and lower(u.email) = v_email
  ) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  -- Reenviar = reemplazar: la invitación anterior de ese correo deja de valer.
  update public.tenant_invitations
    set revoked_at = now()
    where tenant_id = p_tenant and email = v_email and accepted_at is null and revoked_at is null;

  v_limit := public.effective_limit(p_tenant, 'users');
  if v_limit is not null then
    select (select count(*) from public.tenant_members m where m.tenant_id = p_tenant)
         + (select count(*) from public.tenant_invitations i
            where i.tenant_id = p_tenant and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
      into v_taken;
    if v_taken >= v_limit then
      raise exception 'user_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;

  insert into public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
  values (p_tenant, v_email, p_role, p_token_hash, auth.uid())
  returning expires_at into v_expires;

  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (p_tenant, auth.uid(), 'team.invited', jsonb_build_object('email', v_email, 'role', p_role));
  return v_expires;
end;
$$;

create or replace function public.revoke_invitation(p_tenant uuid, p_invitation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_write(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;
  update public.tenant_invitations set revoked_at = now()
    where id = p_invitation and tenant_id = p_tenant and accepted_at is null and revoked_at is null;
  if found then
    insert into public.audit_log (tenant_id, actor_id, action, payload)
    values (p_tenant, auth.uid(), 'team.invitation_revoked', jsonb_build_object('invitation', p_invitation));
  end if;
end;
$$;

create or replace function public.set_member_role(p_tenant uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not public.can_write(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant and t.is_demo) then
    raise exception 'demo_readonly' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select role into v_current from public.tenant_members where tenant_id = p_tenant and user_id = p_user;
  if v_current is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_current = 'owner' then
    raise exception 'cannot_modify_owner' using errcode = 'P0001';
  end if;
  update public.tenant_members set role = p_role where tenant_id = p_tenant and user_id = p_user;
  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (p_tenant, auth.uid(), 'team.role_changed', jsonb_build_object('user', p_user, 'from', v_current, 'to', p_role));
end;
$$;

create or replace function public.remove_member(p_tenant uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  if not public.can_write(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;
  if exists (select 1 from public.tenants t where t.id = p_tenant and t.is_demo) then
    raise exception 'demo_readonly' using errcode = '42501';
  end if;
  select role into v_current from public.tenant_members where tenant_id = p_tenant and user_id = p_user;
  if v_current is null then
    raise exception 'member_not_found' using errcode = 'P0002';
  end if;
  if v_current = 'owner' or p_user = auth.uid() then
    raise exception 'cannot_modify_owner' using errcode = 'P0001';
  end if;
  delete from public.tenant_members where tenant_id = p_tenant and user_id = p_user;
  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (p_tenant, auth.uid(), 'team.member_removed', jsonb_build_object('user', p_user, 'role', v_current));
end;
$$;

revoke execute on function public.team_overview(uuid), public.create_invitation(uuid, text, text, text),
  public.revoke_invitation(uuid, uuid), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid)
  from public, anon;
grant execute on function public.team_overview(uuid), public.create_invitation(uuid, text, text, text),
  public.revoke_invitation(uuid, uuid), public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------- aceptar (solo servidor, tras validar el token)
create or replace function public.invitation_preview(p_token_hash text)
returns table (invitation_id uuid, tenant_name text, tenant_slug text, email text, role text, status text, user_exists boolean)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, t.name, t.slug, i.email, i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      when t.status not in ('active', 'trialing', 'past_due') then 'inactive'
      else 'pending'
    end,
    exists (select 1 from auth.users u where lower(u.email) = i.email)
  from public.tenant_invitations i join public.tenants t on t.id = i.tenant_id
  where i.token_hash = p_token_hash;
$$;

create or replace function public.accept_invitation(p_token_hash text, p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.tenant_invitations;
  v_slug text;
  v_email text;
begin
  select * into v_inv from public.tenant_invitations where token_hash = p_token_hash for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = p_user;
  if v_email is distinct from v_inv.email then
    raise exception 'email_mismatch' using errcode = 'P0001';
  end if;
  select t.slug into v_slug from public.tenants t
    where t.id = v_inv.tenant_id and t.status in ('active', 'trialing', 'past_due');
  if v_slug is null then
    raise exception 'invitation_invalid' using errcode = 'P0001';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_inv.tenant_id, p_user, v_inv.role)
  on conflict (tenant_id, user_id) do nothing;
  update public.tenant_invitations set accepted_at = now() where id = v_inv.id;
  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (v_inv.tenant_id, p_user, 'team.joined', jsonb_build_object('role', v_inv.role));
  return v_slug;
end;
$$;

revoke execute on function public.invitation_preview(text), public.accept_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.invitation_preview(text), public.accept_invitation(text, uuid) to service_role;

-- T04 — Registro vía A.
-- 1) Una prueba gratuita por dueño, dentro de provision_tenant (transaccional).
-- 2) Las escrituras del panel exigen tenant operable (activo o en prueba):
--    un miembro de un tenant suspendido/cancelado ya no escribe por REST/Storage.

-- ============================================================
-- can_write: miembro con rol suficiente en un tenant operable
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
      where t.id = p_tenant_id and t.status in ('active', 'trialing')
    );
$$;

revoke execute on function public.can_write(uuid, text) from public, anon;
grant execute on function public.can_write(uuid, text) to authenticated, service_role;

alter policy properties_editor_write on public.properties
  using (public.can_write(tenant_id, 'editor'))
  with check (public.can_write(tenant_id, 'editor'));

alter policy clients_member_insert on public.clients
  with check (public.can_write(tenant_id));

alter policy clients_editor_update on public.clients
  using (public.can_write(tenant_id, 'editor'))
  with check (public.can_write(tenant_id, 'editor'));

alter policy clients_editor_delete on public.clients
  using (public.can_write(tenant_id, 'editor'));

alter policy quotes_member_insert on public.quotes
  with check (
    public.can_write(tenant_id)
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = quotes.client_id and c.tenant_id = quotes.tenant_id))
    and (property_id is null or exists (
      select 1 from public.properties p where p.id = quotes.property_id and p.tenant_id = quotes.tenant_id))
  );

alter policy quotes_editor_update on public.quotes
  using (public.can_write(tenant_id, 'editor'))
  with check (public.can_write(tenant_id, 'editor'));

alter policy quotes_objects_member_insert on storage.objects
  with check (bucket_id = 'quotes' and public.can_write(public.tenant_from_path(name)));

alter policy property_media_editor_insert on storage.objects
  with check (bucket_id = 'property-media' and public.can_write(public.tenant_from_path(name), 'editor'));

alter policy property_media_editor_delete on storage.objects
  using (bucket_id = 'property-media' and public.can_write(public.tenant_from_path(name), 'editor'));

-- ============================================================
-- provision_tenant: una prueba por dueño
-- ============================================================
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
  perform pg_advisory_xact_lock(hashtext('provision_owner:' || p_owner::text));

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

  if p_source = 'self_signup' then
    if public.is_disposable_email(v_email) then
      raise exception 'email_disposable' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.tenant_members m
      join public.tenants t on t.id = m.tenant_id
      where m.user_id = p_owner and m.role = 'owner' and t.source = 'self_signup'
    ) then
      raise exception 'trial_used' using errcode = '23505';
    end if;
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

revoke execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  to service_role;

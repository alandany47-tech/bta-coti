-- T16 — Mensajes de WhatsApp configurables por módulo (docs/PLAN-MAESTRO.md §6).
-- `body` guarda `{variable}` sin resolver; `lib/message-templates.ts` (`renderMessage`) hace el
-- reemplazo al enviar. `default_message_template` es la fuente para `provision_tenant` y el
-- backfill; debe coincidir con `DEFAULT_TEMPLATES` en TypeScript (comentario cruzado en ambos).

create or replace function public.default_message_template(p_module text)
returns text
language sql
immutable
as $$
  select case p_module
    when 'broker' then
      'Hola {cliente}, aquí el desglose ejecutivo de tu cotización con *{negocio}*:' || chr(10) || chr(10) ||
      '🏠 {propiedad} · Unidad {unidad}' || chr(10) || chr(10) ||
      'Precio: {total}' || chr(10) || 'Enganche: {enganche}' || chr(10) ||
      'Mensualidad: {mensualidad} x {plazo} meses' || chr(10) || chr(10) ||
      'Consulta y descarga tu cotización: {link}'
    else
      'Hola {cliente}, aquí tu cotización de *{negocio}* del {fecha}.' || chr(10) || chr(10) ||
      'Total: {total}' || chr(10) || chr(10) ||
      'Consúltala y descárgala aquí: {link}'
  end;
$$;

create table public.message_templates (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module text not null check (module in ('services', 'catalog', 'broker')),
  channel text not null default 'whatsapp' check (channel = 'whatsapp'),
  body text not null check (char_length(body) between 1 and 1000 and position('<' in body) = 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module, channel)
);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

create trigger message_templates_tenant_id_immutable
  before update on public.message_templates
  for each row execute function public.forbid_tenant_id_change();

alter table public.message_templates enable row level security;

create policy message_templates_member_read on public.message_templates
  for select to authenticated
  using (public.can_read(tenant_id));

create policy message_templates_editor_write on public.message_templates
  for all to authenticated
  using (public.can_write(tenant_id, 'editor'))
  with check (public.can_write(tenant_id, 'editor'));

revoke all on public.message_templates from anon;
revoke insert, truncate, references, trigger on public.message_templates from authenticated;

-- ============================================================
-- Un módulo no se puede quitar de fila; solo INSERT (al aprovisionar) y DELETE (servidor, si un
-- plan pierde un módulo) pasan por la service role.
-- ============================================================
revoke insert, delete on public.message_templates from authenticated;
grant insert, delete on public.message_templates to service_role;

insert into public.message_templates (tenant_id, module, body)
select t.id, m.module, public.default_message_template(m.module)
from public.tenants t
join public.plans p on p.id = t.plan_id
cross join lateral unnest(p.modules) as m(module)
where m.module in ('services', 'catalog', 'broker')
on conflict (tenant_id, module, channel) do nothing;

-- ============================================================
-- provision_tenant: además de lo que ya hacía, crea la plantilla de cada módulo del plan.
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
  v_module text;
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

  for v_module in select unnest(p.modules) from public.plans p where p.id = v_plan_id loop
    if v_module in ('services', 'catalog', 'broker') then
      insert into public.message_templates (tenant_id, module, body)
      values (v_tenant_id, v_module, public.default_message_template(v_module));
    end if;
  end loop;

  return v_tenant_id;
end;
$$;

revoke execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.provision_tenant(uuid, text, text, text, text, int, text, text)
  to service_role;

-- ============================================================
-- tenant_modules: los módulos del plan del tenant, para que el panel sepa qué editores mostrar.
-- ============================================================
create function public.tenant_modules(p_tenant uuid)
returns text[]
language sql
security definer
stable
set search_path = public
as $$
  select p.modules
  from public.tenants t
  join public.plans p on p.id = t.plan_id
  where t.id = p_tenant and public.is_member(p_tenant);
$$;

revoke execute on function public.tenant_modules(uuid) from public, anon;
grant execute on function public.tenant_modules(uuid) to authenticated, service_role;

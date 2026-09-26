-- Endurecimiento tras la revisión de Codex a T13.
-- 1) tenant_id inmutable en properties, clients y quotes: con membresía en dos tenants, un UPDATE
--    directo por PostgREST podía mover la fila (USING acepta el tenant viejo, WITH CHECK el nuevo)
--    y dejar cuotas y medios inconsistentes.
-- 2) set_tenant_status ya no pasa un tenant a 'trialing': dejaría trial_ends_at nulo o vencido.
--    Las pruebas nacen solo por provision_tenant, que exige los días.

create or replace function public.forbid_tenant_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger properties_tenant_id_immutable
  before update on public.properties
  for each row execute function public.forbid_tenant_id_change();

create trigger clients_tenant_id_immutable
  before update on public.clients
  for each row execute function public.forbid_tenant_id_change();

create trigger quotes_tenant_id_immutable
  before update on public.quotes
  for each row execute function public.forbid_tenant_id_change();

create or replace function public.set_tenant_status(
  p_tenant uuid,
  p_status text,
  p_reason text,
  p_actor uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_prev text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_status is null or p_status not in ('active', 'past_due', 'suspended', 'canceled') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if p_status in ('suspended', 'canceled') and v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  select t.slug, t.status into v_slug, v_prev
  from public.tenants t where t.id = p_tenant for update;
  if not found then
    raise exception 'tenant_not_found' using errcode = 'P0002';
  end if;

  update public.tenants set status = p_status, status_reason = v_reason where id = p_tenant;

  insert into public.audit_log (tenant_id, actor_id, action, payload)
  values (p_tenant, p_actor, 'tenant.status_changed',
          jsonb_build_object('from', v_prev, 'to', p_status, 'reason', v_reason));

  return v_slug;
end;
$$;

revoke execute on function public.set_tenant_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_tenant_status(uuid, text, text, uuid) to service_role;

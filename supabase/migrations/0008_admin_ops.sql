-- T05 — Operaciones del admin: conteos desde usage (con triggers que la mantienen),
-- búsqueda de usuario por correo y cambio de estado con auditoría atómica.

-- ============================================================
-- usage: mantenida por triggers
-- ============================================================
create or replace function public.usage_items_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.usage (tenant_id, items_count) values (new.tenant_id, 1)
    on conflict (tenant_id) do update
      set items_count = public.usage.items_count + 1, updated_at = now();
  else
    update public.usage
    set items_count = greatest(items_count - 1, 0), updated_at = now()
    where tenant_id = old.tenant_id;
  end if;
  return null;
end;
$$;

create or replace function public.usage_quotes_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
begin
  insert into public.usage (tenant_id, quotes_this_month, month_key)
  values (new.tenant_id, 1, v_month)
  on conflict (tenant_id) do update
    set quotes_this_month = case
          when public.usage.month_key = v_month then public.usage.quotes_this_month + 1
          else 1
        end,
        month_key = v_month,
        updated_at = now();
  return null;
end;
$$;

revoke execute on function public.usage_items_sync() from public, anon, authenticated;
revoke execute on function public.usage_quotes_sync() from public, anon, authenticated;

create trigger properties_usage_sync
  after insert or delete on public.properties
  for each row execute function public.usage_items_sync();

create trigger quotes_usage_sync
  after insert on public.quotes
  for each row execute function public.usage_quotes_sync();

update public.usage u
set items_count = (select count(*) from public.properties p where p.tenant_id = u.tenant_id),
    quotes_this_month = (
      select count(*) from public.quotes q
      where q.tenant_id = u.tenant_id
        and to_char(q.created_at, 'YYYY-MM') = to_char(now(), 'YYYY-MM')
    ),
    month_key = to_char(now(), 'YYYY-MM'),
    updated_at = now();

-- ============================================================
-- admin_user_id_by_email
-- ============================================================
create or replace function public.admin_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke execute on function public.admin_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.admin_user_id_by_email(text) to service_role;

-- ============================================================
-- set_tenant_status: cambia el estado y deja auditoría en la misma transacción
-- ============================================================
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
  if p_status is null or p_status not in ('trialing', 'active', 'past_due', 'suspended', 'canceled') then
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

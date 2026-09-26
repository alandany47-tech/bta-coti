-- T15 — Cotizaciones congeladas y compartibles.
-- 1) snapshot jsonb (todo lo que muestra el PDF/página), share_token, número consecutivo por
--    tenant, vigencia y contador de vistas. Editar un ítem ya no cambia lo enviado.
-- 2) Los usuarios ya no escriben quotes por REST (cierra el P1 de montos arbitrarios): las crea
--    solo el servidor con service_role (montos recalculados) y solo leen.
-- 3) get_shared_quote(token): lo que lee /q/<token>; suma una vista y marca 'viewed'.
-- 4) Se retira el PDF del servidor: fuera pdf_url y las políticas del bucket `quotes`.

alter table public.quotes
  add column number int,
  add column created_by uuid references auth.users (id) on delete set null,
  add column snapshot jsonb,
  add column share_token text,
  add column expires_at timestamptz,
  add column views int not null default 0,
  add column last_viewed_at timestamptz;

with numbered as (
  select id, row_number() over (partition by tenant_id order by created_at, id) n from public.quotes
)
update public.quotes q
set number = numbered.n,
    share_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    expires_at = q.created_at + interval '30 days',
    snapshot = jsonb_build_object(
      'version', 1,
      'quoteId', q.id,
      'tenantName', t.name,
      'tenantLogoUrl', t.logo_url,
      'brandColor', t.brand_color,
      'advisorName', null,
      'clientName', q.client_name,
      'clientPhone', q.client_phone,
      'property', case when i.id is null then null else jsonb_build_object(
        'id', i.id, 'tenant_id', i.tenant_id, 'title', i.title,
        'unit_number', coalesce(i.attrs ->> 'unit_number', i.sku, ''),
        'm2_interior', coalesce((i.attrs ->> 'm2_interior')::numeric, 0),
        'm2_exterior', coalesce((i.attrs ->> 'm2_exterior')::numeric, 0),
        'm2_total', coalesce((i.attrs ->> 'm2_total')::numeric, 0),
        'parking_spaces', coalesce((i.attrs ->> 'parking')::numeric, 0),
        'list_price', i.price, 'images', to_jsonb(i.images[1:9]), 'floor_plan_url', i.floor_plan_url,
        'status', i.status, 'created_at', i.created_at, 'updated_at', i.updated_at) end,
      'breakdown', jsonb_build_object(
        'effectivePrice', q.total_amount,
        'discountAmount', case when q.discount_pct < 100 then q.total_amount / (1 - q.discount_pct / 100) - q.total_amount else 0 end,
        'downPaymentAmount', q.down_payment_amount,
        'balanceAfterDownPayment', q.total_amount - q.down_payment_amount,
        'installmentsTotal', q.monthly_payment_amount * q.installments_count,
        'monthlyPaymentAmount', q.monthly_payment_amount,
        'finalPaymentAmount', q.final_payment_amount),
      'installmentsCount', q.installments_count,
      'notes', q.notes,
      'createdAt', q.created_at)
from numbered
join public.tenants t on true
left join public.items i on true
where numbered.id = q.id and t.id = q.tenant_id and (i.id = q.property_id or (q.property_id is null and i.id is null));

update public.quotes set snapshot = coalesce(snapshot, '{"version":1}'::jsonb) where snapshot is null;

alter table public.quotes
  alter column number set not null,
  alter column snapshot set not null,
  alter column share_token set not null,
  alter column share_token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  alter column expires_at set default now() + interval '30 days',
  add constraint quotes_share_token_key unique (share_token),
  add constraint quotes_tenant_number_key unique (tenant_id, number),
  add constraint quotes_views_check check (views >= 0);

alter table public.quotes drop constraint quotes_status_check;
alter table public.quotes
  add constraint quotes_status_check
  check (status in ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'));

-- El número consecutivo se asigna bajo el lock de `usage` que ya toma el guard de cuota diaria.
create or replace function public.quotes_quota_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_count bigint;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  perform 1 from public.usage u where u.tenant_id = new.tenant_id for update;

  v_limit := public.effective_limit(new.tenant_id, 'quotes_per_day');
  if v_limit is not null then
    select count(*) into v_count from public.quotes q
    where q.tenant_id = new.tenant_id and q.created_at >= v_day_start;
    if v_count >= v_limit then
      raise exception 'quote_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;

  new.number := coalesce((select max(q.number) from public.quotes q where q.tenant_id = new.tenant_id), 0) + 1;
  return new;
end;
$$;

-- Los usuarios solo leen quotes; el servidor las crea con service_role.
drop policy quotes_member_insert on public.quotes;
drop policy quotes_editor_update on public.quotes;
revoke insert, update, delete, truncate, references, trigger on public.quotes from authenticated;
revoke all on public.quotes from anon;

-- ============================================================
-- get_shared_quote: lectura pública por token
-- ============================================================
create or replace function public.get_shared_quote(p_token text)
returns table (snapshot jsonb, number int, status text, expires_at timestamptz, expired boolean, views int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quotes;
begin
  if p_token is null or length(p_token) < 32 then
    return;
  end if;

  select q.* into v_row
  from public.quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.share_token = p_token and t.status in ('active', 'trialing', 'past_due')
  for update of q;
  if not found then
    return;
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return query select v_row.snapshot, v_row.number, 'expired'::text, v_row.expires_at, true, v_row.views;
    return;
  end if;

  update public.quotes q
  set views = q.views + 1,
      last_viewed_at = now(),
      status = case when q.status = 'sent' then 'viewed' else q.status end
  where q.id = v_row.id
  returning q.views, q.status into v_row.views, v_row.status;

  return query select v_row.snapshot, v_row.number, v_row.status, v_row.expires_at, false, v_row.views;
end;
$$;

revoke execute on function public.get_shared_quote(text) from public;
grant execute on function public.get_shared_quote(text) to anon, authenticated, service_role;

-- ============================================================
-- Fuera el PDF del servidor
-- ============================================================
drop policy if exists quotes_objects_member_select on storage.objects;
drop policy if exists quotes_objects_member_insert on storage.objects;
alter table public.quotes drop column pdf_url;

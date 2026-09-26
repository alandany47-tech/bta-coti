-- Endurecimiento tras la revisión de Codex a T14.
-- 1) Topes del plan por kind al insertar ítems (properties vs items), dentro de la transacción y
--    serializados por tenant con un lock sobre `usage`. Un upsert que solo actualiza una fila
--    existente (mismo sku) no cuenta como alta.
-- 2) Tope diario de cotizaciones (`quotes_per_day`, día de Ciudad de México) al insertar.
-- 3) media.item_id apunta a items: no se borra un ítem con archivos (hay que borrarlos por la API,
--    que también limpia R2 y la cuota).

create or replace function public.items_quota_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit bigint;
  v_count bigint;
begin
  perform 1 from public.usage u where u.tenant_id = new.tenant_id for update;

  if new.sku is not null and exists (
    select 1 from public.items i where i.tenant_id = new.tenant_id and i.sku = new.sku
  ) then
    return new;
  end if;

  v_limit := public.effective_limit(new.tenant_id, case when new.kind = 'property' then 'properties' else 'items' end);
  if v_limit is not null then
    select count(*) into v_count from public.items i
    where i.tenant_id = new.tenant_id and (i.kind = 'property') = (new.kind = 'property');
    if v_count >= v_limit then
      raise exception 'item_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger items_quota_guard
  before insert on public.items
  for each row execute function public.items_quota_guard();

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
  return new;
end;
$$;

create trigger quotes_quota_guard
  before insert on public.quotes
  for each row execute function public.quotes_quota_guard();

alter table public.media
  add constraint media_item_id_fkey foreign key (item_id) references public.items (id);

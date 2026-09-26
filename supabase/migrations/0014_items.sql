-- T14 — `properties` pasa a `items` (kind = product | service | property) con copia de datos.
-- Los ids se conservan, así que media.item_id y quotes.property_id siguen apuntando bien.
-- Atributos de kind = property en attrs: unit_number, m2_interior, m2_exterior, m2_total, parking.
-- Desviaciones del modelo de docs/DATA-MODEL.md: la galería vive en `images` y el plano en
-- `floor_plan_url` (columnas de items, como en properties); no hay `cover_media_id` (portada =
-- images[0]). `sku` es la clave de importación y para propiedades es el número de unidad.

create table public.items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('product', 'service', 'property')),
  title text not null check (btrim(title) <> ''),
  sku text,
  description text,
  price numeric(14, 2) not null default 0 check (price >= 0),
  unit text,
  category text,
  attrs jsonb not null default '{}' check (jsonb_typeof(attrs) = 'object'),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold', 'hidden')),
  sort int not null default 0,
  images text[] not null default '{}',
  floor_plan_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_tenant_id_sku_key unique (tenant_id, sku)
);

create index items_tenant_kind_status_idx on public.items (tenant_id, kind, status);

insert into public.items (id, tenant_id, kind, title, sku, price, unit, attrs, status, images, floor_plan_url, created_at, updated_at)
select p.id, p.tenant_id, 'property', p.title, p.unit_number, p.list_price, 'unidad',
       jsonb_build_object(
         'unit_number', p.unit_number,
         'm2_interior', p.m2_interior,
         'm2_exterior', p.m2_exterior,
         'm2_total', p.m2_total,
         'parking', p.parking_spaces
       ),
       p.status, p.images, p.floor_plan_url, p.created_at, p.updated_at
from public.properties p;

-- ============================================================
-- Triggers (se crean después de la copia para no contar dos veces)
-- ============================================================
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create trigger items_tenant_id_immutable
  before update on public.items
  for each row execute function public.forbid_tenant_id_change();

create trigger items_usage_sync
  after insert or delete on public.items
  for each row execute function public.usage_items_sync();

create or replace function public.items_media_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pattern text := '^https://[a-z0-9]{10,30}\.supabase\.co/storage/v1/object/public/property-media/'
    || new.tenant_id::text || '/[^[:space:]]+$';
  v_url text;
begin
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

create trigger items_media_guard
  before insert or update on public.items
  for each row execute function public.items_media_guard();

-- ============================================================
-- RLS y grants
-- ============================================================
alter table public.items enable row level security;

create policy items_public_read on public.items
  for select to anon, authenticated
  using (
    status <> 'hidden'
    and exists (
      select 1 from public.tenants t
      where t.id = items.tenant_id and t.status in ('active', 'trialing', 'past_due')
    )
  );

create policy items_member_read on public.items
  for select to authenticated
  using (public.can_read(tenant_id));

create policy items_editor_write on public.items
  for all to authenticated
  using (public.can_write(tenant_id, 'editor'))
  with check (public.can_write(tenant_id, 'editor'));

revoke all on public.items from anon;
grant select on public.items to anon;
revoke truncate, references, trigger on public.items from authenticated;

-- ============================================================
-- Referencias: quotes y funciones de medios
-- ============================================================
alter table public.quotes drop constraint quotes_property_id_fkey;
alter table public.quotes
  add constraint quotes_property_id_fkey foreign key (property_id) references public.items (id) on delete set null;

alter policy quotes_member_insert on public.quotes
  with check (
    public.can_write(tenant_id)
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = quotes.client_id and c.tenant_id = quotes.tenant_id))
    and (property_id is null or exists (
      select 1 from public.items i where i.id = quotes.property_id and i.tenant_id = quotes.tenant_id))
  );

comment on column public.media.item_id is 'items.id';

create or replace function public.attach_media_url(p_tenant uuid, p_item uuid, p_kind text, p_url text)
returns table (images text[], floor_plan_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('image', 'render', 'plan') or p_url is null or p_url = '' then
    raise exception 'invalid_params' using errcode = '22023';
  end if;

  return query
  update public.items i
  set images = case
        when p_kind = 'plan' or p_url = any (i.images) then i.images
        else array_append(i.images, p_url)
      end,
      floor_plan_url = case when p_kind = 'plan' then p_url else i.floor_plan_url end
  where i.id = p_item and i.tenant_id = p_tenant
  returning i.images, i.floor_plan_url;

  if not found then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.detach_media_url(p_tenant uuid, p_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.items i
  set images = array_remove(i.images, p_url),
      floor_plan_url = case when i.floor_plan_url = p_url then null else i.floor_plan_url end
  where i.tenant_id = p_tenant and (p_url = any (i.images) or i.floor_plan_url = p_url);
$$;

update public.usage u
set items_count = (select count(*) from public.items i where i.tenant_id = u.tenant_id),
    updated_at = now();

drop table public.properties;
drop function public.properties_media_guard();

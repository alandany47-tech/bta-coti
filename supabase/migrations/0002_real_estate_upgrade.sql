-- BTA Cotiza — pivote a nicho de brokers inmobiliarios de lujo
-- Migra el catálogo genérico (products) a una cartera de propiedades
-- (properties), agrega un mini-CRM de clientes y extiende quotes con el
-- desglose financiero de una operación inmobiliaria (enganche, mensualidades,
-- saldo a escrituración, descuento).

-- ============================================================
-- properties (antes: products)
-- ============================================================
alter table public.products rename to properties;

alter table public.properties drop constraint products_tenant_id_sku_key;

alter index products_pkey rename to properties_pkey;
alter index products_tenant_id_idx rename to properties_tenant_id_idx;
drop index if exists products_tenant_category_idx;
drop index if exists products_tenant_name_trgm_idx;

alter trigger products_set_updated_at on public.properties
  rename to properties_set_updated_at;

alter table public.properties rename column name to title;
alter table public.properties rename column price to list_price;

alter table public.properties
  drop column sku,
  drop column description,
  drop column category,
  drop column is_custom_price;

alter table public.properties
  add column unit_number text not null default '',
  add column m2_interior numeric(10, 2) not null default 0,
  add column m2_exterior numeric(10, 2) not null default 0,
  add column m2_total numeric(10, 2) not null default 0,
  add column parking_spaces integer not null default 0,
  add column images text[] not null default '{}',
  add column floor_plan_url text,
  add column status text not null default 'available'
    check (status in ('available', 'reserved', 'sold'));

alter table public.properties alter column unit_number drop default;

alter table public.properties
  add constraint properties_tenant_id_unit_number_key unique (tenant_id, unit_number);

create index properties_tenant_status_idx on public.properties (tenant_id, status);

-- RLS: mismo criterio que el catálogo original — lectura pública solo de
-- tenants activos, escritura solo vía Service Role (Route Handlers).
drop policy if exists "products_public_read_active_tenant" on public.properties;

create policy "properties_public_read_active_tenant" on public.properties
  for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = properties.tenant_id
        and t.status = 'active'
    )
  );

-- ============================================================
-- clients (mini-CRM de cartera)
-- ============================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

create index clients_tenant_id_idx on public.clients (tenant_id);
create index clients_tenant_phone_idx on public.clients (tenant_id, phone);
create index clients_tenant_name_idx on public.clients (tenant_id, full_name);

alter table public.clients enable row level security;

-- clients: contiene PII (teléfono/email). Sin policies de select/insert para
-- anon/authenticated => acceso denegado por defecto, igual que quotes. La
-- búsqueda del mini-CRM en el cotizador pasa por /api/[tenant]/clients
-- (Service Role Key), nunca por el cliente de anon key.

-- ============================================================
-- quotes: esquema financiero inmobiliario
-- ============================================================
alter table public.quotes
  add column property_id uuid references public.properties (id) on delete set null,
  add column client_id uuid references public.clients (id) on delete set null,
  add column discount_pct numeric(5, 2) not null default 0,
  add column down_payment_pct numeric(5, 2) not null default 0,
  add column down_payment_amount numeric(12, 2) not null default 0,
  add column installments_count integer not null default 0,
  add column monthly_payment_amount numeric(12, 2) not null default 0,
  add column final_payment_amount numeric(12, 2) not null default 0,
  add column notes text;

-- El carrito multi-ítem (jsonb) ya no aplica: una cotización inmobiliaria es
-- una propiedad por operación. property_id + los montos ya calculados en la
-- propia fila son la fuente de verdad histórica de la cotización.
alter table public.quotes drop column items;

create index quotes_tenant_property_idx on public.quotes (tenant_id, property_id);
create index quotes_tenant_client_idx on public.quotes (tenant_id, client_id);

-- ============================================================
-- Storage: bucket público para imágenes y planos de propiedades
-- ============================================================
insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do nothing;

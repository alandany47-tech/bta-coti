-- BTA Cotiza — esquema inicial multi-tenant
-- Aislamiento por tenant_id + Row Level Security.

create extension if not exists "pgcrypto";

-- ============================================================
-- tenants
-- ============================================================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  brand_color text not null default '#FAFAFA',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index tenants_slug_idx on public.tenants (slug);

-- ============================================================
-- products
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sku text not null,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  category text,
  is_custom_price boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create index products_tenant_id_idx on public.products (tenant_id);
create index products_tenant_category_idx on public.products (tenant_id, category);
-- búsqueda por nombre/sku en el buscador del cotizador
create index products_tenant_name_trgm_idx on public.products (tenant_id, name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ============================================================
-- quotes
-- ============================================================
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_name text not null,
  client_phone text not null,
  items jsonb not null default '[]'::jsonb,
  total_amount numeric(12, 2) not null default 0,
  pdf_url text,
  status text not null default 'sent' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index quotes_tenant_id_idx on public.quotes (tenant_id);
create index quotes_tenant_created_idx on public.quotes (tenant_id, created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Nota de arquitectura: este MVP todavía no tiene login por tenant (fuera de
-- alcance de este ticket). Por eso las escrituras (import de catálogo, alta
-- de cotizaciones) se hacen desde Route Handlers usando la Service Role Key
-- de Supabase, que ignora RLS por diseño. RLS aquí protege la vía pública
-- (anon key) que usa el front del cotizador para LEER catálogo/branding,
-- y deniega por defecto cualquier escritura o lectura de cotizaciones desde
-- el cliente.

alter table public.tenants enable row level security;
alter table public.products enable row level security;
alter table public.quotes enable row level security;

-- tenants: lectura pública (se necesita para resolver slug -> nombre/logo/color
-- antes de saber si el visitante "pertenece" a ese tenant).
create policy "tenants_public_read" on public.tenants
  for select
  using (true);

-- products: lectura pública solo del catálogo de tenants activos.
-- No hay policy de insert/update/delete => solo la service role puede escribir.
create policy "products_public_read_active_tenant" on public.products
  for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = products.tenant_id
        and t.status = 'active'
    )
  );

-- quotes: sin policies de select/insert para anon/authenticated => acceso
-- denegado por defecto. Todo alta/lectura de cotizaciones pasa por el
-- backend (service role) en /api/[tenant]/quotes.

-- ============================================================
-- Storage: bucket público para los PDFs de cotización
-- ============================================================
insert into storage.buckets (id, name, public)
values ('quotes', 'quotes', true)
on conflict (id) do nothing;

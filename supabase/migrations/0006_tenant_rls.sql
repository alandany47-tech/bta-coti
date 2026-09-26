-- T03 — RLS del panel del tenant: las escrituras dejan la service role y pasan
-- por la sesión del usuario. Roles (AUTH-ONBOARDING §6): viewer lee y crea
-- cotizaciones y clientes; editor escribe propiedades, medios e importa.

-- ============================================================
-- properties
-- ============================================================
create policy properties_editor_write on public.properties
  for all to authenticated
  using (public.is_member(tenant_id, 'editor'))
  with check (public.is_member(tenant_id, 'editor'));

revoke insert, update, delete, truncate, references, trigger on public.properties from anon;
revoke truncate, references, trigger on public.properties from authenticated;

-- ============================================================
-- clients (PII)
-- ============================================================
create policy clients_member_read on public.clients
  for select to authenticated
  using (public.is_member(tenant_id));

create policy clients_member_insert on public.clients
  for insert to authenticated
  with check (public.is_member(tenant_id));

create policy clients_editor_update on public.clients
  for update to authenticated
  using (public.is_member(tenant_id, 'editor'))
  with check (public.is_member(tenant_id, 'editor'));

create policy clients_editor_delete on public.clients
  for delete to authenticated
  using (public.is_member(tenant_id, 'editor'));

revoke all on public.clients from anon;
revoke truncate, references, trigger on public.clients from authenticated;

-- ============================================================
-- quotes
-- ============================================================
create policy quotes_member_read on public.quotes
  for select to authenticated
  using (public.is_member(tenant_id));

-- El cliente y la propiedad referenciados deben ser del mismo tenant.
create policy quotes_member_insert on public.quotes
  for insert to authenticated
  with check (
    public.is_member(tenant_id)
    and (client_id is null or exists (
      select 1 from public.clients c where c.id = quotes.client_id and c.tenant_id = quotes.tenant_id))
    and (property_id is null or exists (
      select 1 from public.properties p where p.id = quotes.property_id and p.tenant_id = quotes.tenant_id))
  );

create policy quotes_editor_update on public.quotes
  for update to authenticated
  using (public.is_member(tenant_id, 'editor'))
  with check (public.is_member(tenant_id, 'editor'));

revoke all on public.quotes from anon;
revoke delete, truncate, references, trigger on public.quotes from authenticated;

-- ============================================================
-- Storage: la primera carpeta del objeto es el id del tenant
-- ============================================================
create or replace function public.tenant_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

create policy quotes_objects_member_select on storage.objects
  for select to authenticated
  using (bucket_id = 'quotes' and public.is_member(public.tenant_from_path(name)));

create policy quotes_objects_member_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quotes' and public.is_member(public.tenant_from_path(name)));

create policy property_media_editor_select on storage.objects
  for select to authenticated
  using (bucket_id = 'property-media' and public.is_member(public.tenant_from_path(name), 'editor'));

create policy property_media_editor_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-media' and public.is_member(public.tenant_from_path(name), 'editor'));

create policy property_media_editor_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-media' and public.is_member(public.tenant_from_path(name), 'editor'));

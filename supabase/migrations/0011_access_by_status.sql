-- Endurecimiento tras la 2.ª revisión de Codex:
-- 1) Las lecturas de datos del tenant (clientes, cotizaciones, medios) también exigen tenant
--    operable: un tenant suspendido/cancelado solo conserva facturación (AUTH-ONBOARDING §5).
-- 2) La lectura pública de propiedades incluye past_due (periodo de gracia).
-- 3) Los cambios de estado de tenants solo pasan por set_tenant_status (con auditoría):
--    se revoca UPDATE directo a authenticated.

create or replace function public.can_read(p_tenant_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.can_write(p_tenant_id, p_min_role);
$$;

revoke execute on function public.can_read(uuid, text) from public, anon;
grant execute on function public.can_read(uuid, text) to authenticated, service_role;

alter policy clients_member_read on public.clients
  using (public.can_read(tenant_id));

alter policy quotes_member_read on public.quotes
  using (public.can_read(tenant_id));

alter policy quotes_objects_member_select on storage.objects
  using (bucket_id = 'quotes' and public.can_read(public.tenant_from_path(name)));

alter policy property_media_editor_select on storage.objects
  using (bucket_id = 'property-media' and public.can_read(public.tenant_from_path(name), 'editor'));

alter policy properties_public_read_active_tenant on public.properties
  using (
    exists (
      select 1 from public.tenants t
      where t.id = properties.tenant_id
        and t.status in ('active', 'trialing', 'past_due')
    )
  );

revoke update on public.tenants from authenticated;

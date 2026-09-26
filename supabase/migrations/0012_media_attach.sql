-- T13 — Uploader a R2: los medios de propiedades ya no pasan por Supabase Storage.
-- 1) Se retiran las políticas de escritura/lectura de `property-media` (cierra el P1 de subidas
--    directas sin límites). El bucket queda solo con lo ya publicado, que no se toca.
-- 2) attach/detach de URLs en properties.images / floor_plan_url, solo service_role: las escribe
--    el servidor tras confirmar el archivo en R2 (el trigger de 0009 impide que el usuario
--    escriba URLs que no sean de su carpeta).

drop policy if exists property_media_editor_select on storage.objects;
drop policy if exists property_media_editor_insert on storage.objects;
drop policy if exists property_media_editor_delete on storage.objects;

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
  update public.properties p
  set images = case
        when p_kind = 'plan' or p_url = any (p.images) then p.images
        else array_append(p.images, p_url)
      end,
      floor_plan_url = case when p_kind = 'plan' then p_url else p.floor_plan_url end
  where p.id = p_item and p.tenant_id = p_tenant
  returning p.images, p.floor_plan_url;

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
  update public.properties p
  set images = array_remove(p.images, p_url),
      floor_plan_url = case when p.floor_plan_url = p_url then null else p.floor_plan_url end
  where p.tenant_id = p_tenant and (p_url = any (p.images) or p.floor_plan_url = p_url);
$$;

revoke execute on function public.attach_media_url(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.detach_media_url(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_media_url(uuid, uuid, text, text) to service_role;
grant execute on function public.detach_media_url(uuid, text) to service_role;

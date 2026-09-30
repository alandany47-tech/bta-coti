-- T23: Onboarding de 3 pasos (logo y color -> ítems -> primera cotización).
-- "Ítems" y "primera cotización" ya tienen UI (/panel/importar, /panel); "logo y color" es lo
-- único que no existía: nadie podía editar tenants.logo_url/brand_color después del alta. El
-- pipeline de medios ya contemplaba un kind "logo" sin item_id (lib/media.ts); solo faltaba a
-- dónde ligar esa URL. Mismo patrón que attach_media_url/set_tenant_status: RPC security definer,
-- nunca RLS de tabla directa sobre tenants.

-- set_tenant_logo: solo la llama /api/media/confirm (service role), que ya validó sesión + rol
-- editor antes de llegar aquí — mismo nivel de confianza que attach_media_url.
create or replace function public.set_tenant_logo(p_tenant uuid, p_url text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tenants set logo_url = p_url where id = p_tenant;
$$;

revoke execute on function public.set_tenant_logo(uuid, text) from public, anon, authenticated;
grant execute on function public.set_tenant_logo(uuid, text) to service_role;

-- update_tenant_branding: la llama la sesión directo (nunca service role, como el resto de
-- /api/[tenant]/*). Cualquier hex vale para brand_color — docs/BRAND.md es la paleta del
-- producto, no una restricción para el tenant.
create or replace function public.update_tenant_branding(p_tenant uuid, p_brand_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_tenant, 'editor') then
    raise exception 'not_authorized';
  end if;
  if p_brand_color !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'invalid_color' using errcode = '22023';
  end if;

  update public.tenants set brand_color = p_brand_color where id = p_tenant;
end;
$$;

revoke execute on function public.update_tenant_branding(uuid, text) from public, anon;
grant execute on function public.update_tenant_branding(uuid, text) to authenticated;

-- dismiss_onboarding: "Saltar por ahora" — cualquier miembro puede saltarlo para todo el tenant
-- (es un dato de tenant, no por-usuario).
create or replace function public.dismiss_onboarding(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_tenant, 'viewer') then
    raise exception 'not_authorized';
  end if;

  update public.tenants
  set settings = settings || '{"onboarding_skipped": true}'::jsonb
  where id = p_tenant;
end;
$$;

revoke execute on function public.dismiss_onboarding(uuid) from public, anon;
grant execute on function public.dismiss_onboarding(uuid) to authenticated;

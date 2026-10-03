-- T31 — Plantilla de cotización del negocio. El ASPECTO (colores, tipografía, disposición) vive en
-- código (`lib/quote-templates.ts`), que leen la página web y el PDF; aquí solo se guarda cuál eligió
-- el negocio. La lista y su orden DEBEN coincidir con `QUOTE_TEMPLATES`: el orden es el de
-- `plans.limits.templates` (límite N = las primeras N; null = todas).
-- Las cotizaciones ya creadas no cambian: el snapshot congela la plantilla con la que se hicieron.
alter table public.tenants
  add column quote_template text not null default 'clasica'
  check (quote_template in ('clasica', 'moderna', 'editorial'));

-- Dato no sensible (un nombre de plantilla); lo lee la caché pública del tenant.
grant select (quote_template) on public.tenants to anon, authenticated;

-- La llama la sesión del editor directo (nunca service role), como update_tenant_branding (0027).
-- El tope del plan se impone aquí, no solo en la UI.
create or replace function public.set_quote_template(p_tenant uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rank int := array_position(array['clasica', 'moderna', 'editorial'], p_code);
  v_limit bigint;
begin
  if not public.is_member(p_tenant, 'editor') then
    raise exception 'not_authorized';
  end if;
  if v_rank is null then
    raise exception 'invalid_template' using errcode = '22023';
  end if;

  v_limit := public.effective_limit(p_tenant, 'templates');
  if v_limit is not null and v_rank > v_limit then
    raise exception 'template_not_in_plan' using errcode = 'P0001';
  end if;

  update public.tenants set quote_template = p_code where id = p_tenant;
end;
$$;

revoke execute on function public.set_quote_template(uuid, text) from public, anon;
grant execute on function public.set_quote_template(uuid, text) to authenticated;

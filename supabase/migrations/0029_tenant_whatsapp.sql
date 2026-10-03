-- T28 — WhatsApp de contacto del negocio, visible en su vitrina pública.
-- Sirve para el botón "Enviar mi cotización por WhatsApp" y "Consultar" del catálogo: el visitante
-- escribe directo al negocio. Solo dígitos con lada de país (10 a 15), sin "+" ni espacios; nulo =
-- el botón abre WhatsApp sin destinatario (el visitante elige el contacto).
alter table public.tenants
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$');

-- Es un dato público del negocio (el mismo que ya pondría en su Instagram o su letrero).
grant select (whatsapp) on public.tenants to anon, authenticated;

-- La llama la sesión (editor del tenant) directo, nunca service role: misma regla que
-- update_tenant_branding (0027). Cadena vacía = quitar el número.
create or replace function public.update_tenant_whatsapp(p_tenant uuid, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
begin
  if not public.is_member(p_tenant, 'editor') then
    raise exception 'not_authorized';
  end if;
  if v_digits is not null and v_digits !~ '^[0-9]{10,15}$' then
    raise exception 'invalid_whatsapp' using errcode = '22023';
  end if;

  update public.tenants set whatsapp = v_digits where id = p_tenant;
end;
$$;

revoke execute on function public.update_tenant_whatsapp(uuid, text) from public, anon;
grant execute on function public.update_tenant_whatsapp(uuid, text) to authenticated;

-- Hallazgo de Codex (P2) sobre 0029: un valor NO vacío sin dígitos ("abc", "+") se normalizaba a
-- NULL y borraba en silencio el número guardado. Solo la cadena vacía (o nula) significa "quitar".
create or replace function public.update_tenant_whatsapp(p_tenant uuid, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw text := btrim(coalesce(p_whatsapp, ''));
  v_digits text := nullif(regexp_replace(v_raw, '[^0-9]', '', 'g'), '');
begin
  if not public.is_member(p_tenant, 'editor') then
    raise exception 'not_authorized';
  end if;
  if v_raw <> '' and (v_digits is null or v_digits !~ '^[0-9]{10,15}$') then
    raise exception 'invalid_whatsapp' using errcode = '22023';
  end if;

  update public.tenants set whatsapp = v_digits where id = p_tenant;
end;
$$;

-- Endurecimiento tras la revisión de Codex a T15.
-- 1) get_shared_quote ya no devuelve el snapshot (nombre/teléfono del cliente, montos, notas,
--    ítem) de una cotización vencida: solo metadatos públicos del tenant, que ya se ven en el
--    storefront. Antes cualquiera con el token vencido podía seguir leyendo todo llamando al RPC
--    directo con la anon key, aunque la página ya ocultaba esos campos.
-- 2) tenant_slug en la respuesta: la página del token vive en el subdominio del tenant
--    (docs/PLAN-MAESTRO.md §5); si alguien entra por el subdominio equivocado, se redirige.
-- 3) Backfill de snapshots inservibles (cotización sin ítem, p. ej. porque ya no existía al migrar
--    a T15): en vez de `{"version":1}` (que `parseQuoteSnapshot` rechaza), un snapshot mínimo con
--    los propios montos ya guardados en la fila y `property = null`.

drop function public.get_shared_quote(text);

create function public.get_shared_quote(p_token text)
returns table (
  snapshot jsonb, number int, status text, expires_at timestamptz, expired boolean, views int,
  tenant_slug text, tenant_name text, tenant_logo_url text, brand_color text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.quotes;
  v_slug text;
  v_name text;
  v_logo text;
  v_color text;
begin
  if p_token is null or length(p_token) < 32 then
    return;
  end if;

  select q.* into v_row
  from public.quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.share_token = p_token and t.status in ('active', 'trialing', 'past_due')
  for update of q;
  if not found then
    return;
  end if;

  select t.slug, t.name, t.logo_url, t.brand_color into v_slug, v_name, v_logo, v_color
  from public.tenants t where t.id = v_row.tenant_id;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return query select null::jsonb, v_row.number, 'expired'::text, v_row.expires_at, true, v_row.views,
      v_slug, v_name, v_logo, v_color;
    return;
  end if;

  update public.quotes q
  set views = q.views + 1,
      last_viewed_at = now(),
      status = case when q.status = 'sent' then 'viewed' else q.status end
  where q.id = v_row.id
  returning q.views, q.status into v_row.views, v_row.status;

  return query select v_row.snapshot, v_row.number, v_row.status, v_row.expires_at, false, v_row.views,
    v_slug, v_name, v_logo, v_color;
end;
$$;

revoke execute on function public.get_shared_quote(text) from public;
grant execute on function public.get_shared_quote(text) to anon, authenticated, service_role;

update public.quotes q
set snapshot = jsonb_build_object(
  'version', 1, 'quoteId', q.id, 'number', q.number, 'tenantName', t.name, 'tenantLogoUrl', t.logo_url,
  'brandColor', t.brand_color, 'advisorName', null, 'clientName', q.client_name, 'clientPhone', q.client_phone,
  'property', null,
  'breakdown', jsonb_build_object(
    'effectivePrice', q.total_amount, 'discountAmount', 0, 'downPaymentAmount', q.down_payment_amount,
    'balanceAfterDownPayment', q.total_amount - q.down_payment_amount,
    'installmentsTotal', q.monthly_payment_amount * q.installments_count,
    'monthlyPaymentAmount', q.monthly_payment_amount, 'finalPaymentAmount', q.final_payment_amount),
  'installmentsCount', q.installments_count, 'notes', q.notes, 'createdAt', q.created_at)
from public.tenants t
where t.id = q.tenant_id and q.snapshot = '{"version":1}'::jsonb;

-- Resolución sin contar vista: la usa el redirector del dominio raíz (`app/q/[token]`) antes de
-- mandar al subdominio del tenant, donde `get_shared_quote` sí cuenta la visita real.
create function public.get_quote_tenant_slug(p_token text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select t.slug
  from public.quotes q
  join public.tenants t on t.id = q.tenant_id
  where q.share_token = p_token and length(p_token) >= 32 and t.status in ('active', 'trialing', 'past_due');
$$;

revoke execute on function public.get_quote_tenant_slug(text) from public;
grant execute on function public.get_quote_tenant_slug(text) to anon, authenticated, service_role;

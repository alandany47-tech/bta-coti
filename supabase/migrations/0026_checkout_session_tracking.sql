-- Hallazgo de Codex sobre T20: reserve_stripe_checkout se libera sola a los 5 minutos, pero una
-- Checkout Session de tarjeta sigue viva hasta 24 h (default de Stripe, no se fija expires_at aquí).
-- Si el dueño reintenta después de esos 5 minutos (sin haber pagado la primera) y luego completa
-- AMBAS sesiones —la vieja, todavía válida, y la nueva—, Stripe crea dos suscripciones reales y
-- cobrables; el webhook solo alcanza a rastrear una localmente (subscriptions.tenant_id es PK).
-- Se guarda el id de la Checkout Session activa para poder expirar la anterior de verdad en Stripe
-- antes de crear una nueva, en vez de solo confiar en una ventana de tiempo.

alter table public.tenants add column stripe_checkout_session_id text;

create or replace function public.record_stripe_checkout_session(p_tenant uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_tenant, 'owner') then
    raise exception 'not_authorized';
  end if;

  update public.tenants set stripe_checkout_session_id = p_session_id where id = p_tenant;
end;
$$;

revoke execute on function public.record_stripe_checkout_session(uuid, text) from public, anon;
grant execute on function public.record_stripe_checkout_session(uuid, text) to authenticated;

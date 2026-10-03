-- T25 — Registro de correos transaccionales enviados. Sirve de candado de idempotencia: el cron
-- diario y los webhooks reclaman la fila (insert) ANTES de mandar y la sueltan (delete) si el envío
-- falla, así un reintento o un doble disparo nunca duplica el correo.
--   welcome / trial_day5 / trial_day7 / trial_expired → ref = '' (uno por tenant)
--   payment_failed → ref = id de la factura de Stripe (uno por factura, aunque Stripe reintente el cobro)
create table public.email_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'trial_day5', 'trial_day7', 'trial_expired', 'payment_failed')),
  ref text not null default '',
  sent_to text,
  created_at timestamptz not null default now(),
  constraint email_log_unique unique (tenant_id, kind, ref)
);

-- Solo la llave de servicio (cron/webhooks) lo toca; sin políticas = nadie más lo lee.
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

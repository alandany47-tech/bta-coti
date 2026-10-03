-- T10/T34 — Subdominios que el dominio comodín (`*.ayxco.app`) no debe regalar a un negocio porque ya los
-- usa la infraestructura: `send` (el correo de Resend vive en send.ayxco.app: MX y SPF), `resend`,
-- `ns1`/`ns2`, `smtp`, `mx`, `email`, `webmail` y los entornos `preview`/`staging`/`dev`
-- (`preview.ayxco.app` es el dominio raíz de los previews). Un negocio con uno de estos nombres tendría una
-- vitrina que nunca resuelve (el registro MX/TXT existe y el comodín no aplica a ese nombre).
insert into public.blocked_terms (term, kind)
select public.normalize_slug(t), 'reserved'
from (values
  ('send'), ('resend'), ('ns1'), ('ns2'), ('smtp'), ('mx'), ('email'), ('correo'), ('webmail'),
  ('preview'), ('staging'), ('dev')
) as v(t)
on conflict (term) do nothing;

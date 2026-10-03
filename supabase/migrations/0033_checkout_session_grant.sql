-- Hallazgo de la revisión de Stripe (T35): 0026 agregó `tenants.stripe_checkout_session_id` pero no
-- lo incluyó en el GRANT SELECT por columna de `authenticated`. La ruta de checkout lo pedía en el
-- mismo select que `plan_id`, `stripe_customer_id` y `stripe_subscription_id`, así que TODA la
-- consulta fallaba con "permission denied" y la ruta seguía como si el tenant no tuviera nada:
-- no veía la suscripción existente (el 409 "usa el portal"), ni el plan actual (la validación de
-- excesos al bajar de plan), ni el customer (creaba uno nuevo en cada intento) ni la sesión previa
-- (nunca la expiraba). Es solo un id de Stripe de su propio tenant (RLS): mismo trato que los demás stripe_*.
grant select (stripe_checkout_session_id) on public.tenants to authenticated;

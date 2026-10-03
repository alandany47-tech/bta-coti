# Stripe: cobros y suscripciones

> MXN, sin IVA desglosado y sin CFDI (D13). Stripe manda recibos automáticos por correo; activarlo en Settings → Emails.
> Verificar comisiones y límites vigentes en stripe.com/en-mx/pricing antes de lanzar.

## 1. Catálogo en Stripe

- **Un Product por plan:** Esencial, Catálogo, Broker, Broker Pro.
- **Dos Prices por producto:** mensual y anual. `lookup_key` = `<plan>_month` / `<plan>_year`.
- En la DB: `plans.stripe_price_month` y `plans.stripe_price_year`. El código busca por `lookup_key` y no hardcodea IDs.
- **Extras:**
  - Plantilla premium: Price de pago único (Checkout `mode: payment`).
  - +5 GB: Price recurrente que se agrega como segundo item de la suscripción.
- Un script `scripts/stripe-sync.ts` crea o actualiza productos y precios desde la tabla `plans`. Así test y live quedan iguales.

## 2. Prueba y primer pago

- **La prueba de 7 días la maneja nuestra app, no Stripe** (sin tarjeta). Al elegir plan: Checkout sin `trial_period_days`.
- `client_reference_id = tenant_id` y `metadata.tenant_id` en Checkout y en la suscripción. Se reutiliza `stripe_customer_id` si existe (un customer por tenant).

## 3. Métodos de pago

> **Corrección (T20, verificado contra Stripe de prueba real, no solo contra la documentación):**
> **OXXO no sirve para cobro recurrente.** Checkout rechaza `oxxo` en `mode: "subscription"`
> ("cannot be used in `subscription` mode") y la API de suscripciones tampoco lo acepta en
> `payment_settings.payment_method_types` — Stripe simplemente no ofrece OXXO para facturación
> recurrente hoy. Se quitó como opción del plan; si algún día se agrega, sería solo para un pago
> único (la plantilla premium de §1, Checkout `mode: "payment"`), no para la suscripción.

| Método | Cómo | Notas |
|---|---|---|
| Tarjeta | Checkout (`mode: "subscription"`), `charge_automatically` | Se cobra solo. 3DS automático. Radar activado con reglas por defecto |
| SPEI | Suscripción creada directo con la API (`collection_method: "send_invoice"`, `payment_settings.payment_method_types: ["customer_balance"]`) — **no por Checkout**, que también la rechaza en `mode: "subscription"`. Se manda al cliente al `hosted_invoice_url` de la primera factura ya finalizada (`stripe.invoices.finalizeInvoice`) | CLABE virtual por cliente. Se concilia sola. Sin tope práctico. El customer necesita correo (Stripe lo exige para `send_invoice`) |

- En `/panel/facturacion` el cliente elige "Tarjeta (se renueva sola)" o "SPEI (pagas cada periodo)".
- Para SPEI, `days_until_due: 3` hace que cada factura (incluidas las de renovación) venza 3 días después de generarse; los recordatorios de Stripe (día −3/0/+3) se activan en Dashboard → Settings → Billing → Automations.
- Un tenant con suscripción activa cambia de plan por el Portal (§5), nunca creando un segundo Checkout/suscripción — `app/api/[tenant]/billing/checkout` lo rechaza con 409 si `tenants.stripe_subscription_id` ya existe.

## 4. Cambios de plan

- **Upgrade:** inmediato con prorrateo (`proration_behavior: always_invoice`).
- **Downgrade:** al fin del periodo (Portal configurado así).
- **Antes del downgrade, validar uso:** si `usage` supera los límites del plan nuevo, se bloquea y se muestra qué sobra ("Tienes 80 ítems; el plan Esencial permite 50").
- **Si se superan los límites por cualquier otra vía** (por ejemplo, un cambio desde el admin): la cuenta queda en **solo lectura para crear ítems y subir medios** hasta ajustarse. Las cotizaciones siguen funcionando.
- **Cancelación:** al fin del periodo (`cancel_at_period_end`). Sin reembolsos prorrateados.

## 5. Customer Portal

- Habilitado: actualizar método de pago, ver facturas, cambiar entre planes públicos, cancelar al fin del periodo.
- Deshabilitado: cambiar cantidad y pausar.

## 6. Webhooks (`/api/stripe/webhook`, runtime nodejs)

| Evento | Acción |
|---|---|
| `checkout.session.completed` | Solo activa (estado → `active`), y solo si `payment_status === "paid"` — ligar customer/suscripción al tenant lo hace `customer.subscription.created` (dispara para toda suscripción, venga de Checkout o de la API directa de SPEI) |
| `customer.subscription.created` / `updated` | Liga `stripe_customer_id`/`plan_id` al tenant y sincroniza `subscriptions` (plan, periodo, `cancel_at_period_end`) |
| `customer.subscription.deleted` | Estado → `canceled` |
| `invoice.finalized` | SPEI: correo propio con la CLABE + link al `hosted_invoice_url` (infra de correo pendiente, T20 solo deja el log) |
| `invoice.paid` | Estado → `active` y se limpia `status_reason` |
| `invoice.payment_failed` | Tarjeta rechazada (`charge_automatically`). Estado → `past_due` |
| `invoice.overdue` | Equivalente de `payment_failed` para SPEI/`send_invoice` (esas facturas nunca disparan `payment_failed` aunque nadie las pague). Estado → `past_due` |
| `charge.dispute.created` | Alerta inmediata al admin (correo + WhatsApp de soporte) y marca en el tenant |

- `invoice.paid`/`invoice.payment_failed`/`invoice.overdue` resuelven el tenant primero por `invoice.parent.subscription_details.metadata.tenant_id` (foto fija de los metadata de la suscripción al facturar, no depende de que `customer.subscription.created` ya haya guardado la fila local — Stripe no garantiza el orden de entrega de los webhooks) y solo si falta caen a buscar en `subscriptions` por `stripe_subscription_id`.
- Los 7 días de gracia en `past_due` (tanto por tarjeta como por SPEI) no los cuenta Stripe: el cron diario (`expire_past_due()`, T20) los deriva de `tenants.status_changed_at` y suspende (`payment_failed`) cuando se cumplen.
- **Firma verificada** (`STRIPE_WEBHOOK_SECRET`). Tabla `stripe_events(id pk, type, processed_at)` para idempotencia — se marca DESPUÉS de aplicar los efectos del evento, nunca antes: si se marcara antes y el procesamiento reventara a la mitad, un reintento de Stripe chocaría con la primary key y saldría sin completar lo que faltaba.
- Todo cambio de estado pasa por `setTenantStatus()` (auditoría + invalidar caché); si falla, el webhook revienta (500) para que Stripe reintente en vez de responder 200 con el tenant desincronizado.
- **Reintentos de tarjeta:** Smart Retries activado (4 intentos en 2 semanas), con la regla de "marcar como unpaid" al final → `suspended`.

## 7. Pruebas

- Stripe CLI: `stripe listen --forward-to localhost:3100/api/stripe/webhook` (3100 es el puerto de `.claude/launch.json`).
- **Test Clocks** para simular renovación, fallo y cancelación sin esperar un mes.
- Casos obligatorios:
  - Pago con tarjeta OK (verificado: activa y sincroniza `plan_id`/`subscriptions`).
  - Tarjeta rechazada.
  - SPEI: suscripción creada, factura finalizada (verificado), pagada de más o de menos (el saldo queda a favor), y vencida sin pagar (`invoice.overdue` → `past_due`, y a los 7 días ahí el cron suspende).
  - Upgrade, downgrade bloqueado por uso, cancelación y disputa.
  - Un tenant con suscripción activa no puede crear otra desde `app/api/[tenant]/billing/checkout` (409, debe usar el Portal).

## 7b. Revisión de punta a punta (T35, 2026-10-03)

Corrida contra Stripe en modo prueba y la base real: `npm run stripe:e2e` (30 comprobaciones, requisitos en el encabezado de `scripts/stripe-e2e.mjs`). Resultado final: **30/30**. Qué cubre y qué no:

| Cubierto | Cómo |
|---|---|
| Checkout con tarjeta: modo, método, `tenant_id`, precio del plan, URLs de retorno, reserva (409 al doble clic), expiración de la sesión previa | Se lee la sesión de Stripe y se compara |
| Pago aprobado → `active`, `plan_id`, fila en `subscriptions`; `expire_trials` no la toca | Suscripción creada por API con `pm_card_visa` (equivale a completar Checkout) y webhooks reales por `stripe listen` |
| 409 si ya hay suscripción; Portal devuelve su URL | Rutas reales con la sesión del dueño |
| Cobro rechazado → `past_due` + correo T25 una vez por factura; pago de la factura → `active` y plan nuevo | `pm_card_chargeCustomerFail` en una mejora de plan con prorrateo |
| Firma inválida → 400; mismo evento dos veces → un solo efecto | Eventos firmados con el secreto real |
| Cancelación → `canceled` y se limpia `stripe_subscription_id`; bajar de plan con exceso → 409 con detalle | |
| SPEI: factura `send_invoice` a 3 días, el tenant NO se activa hasta pagar, pagada → `active` | `test_helpers/customers/{id}/fund_cash_balance` |
| Día 8 en `past_due` → `expire_past_due` suspende | |

**Hallazgos corregidos (migración 0033, ruta de checkout y webhook):**
1. **Crítico — la ruta de checkout no veía el tenant.** 0026 agregó `stripe_checkout_session_id` sin darle `GRANT SELECT` a `authenticated`; el `select` de la ruta fallaba completo y seguía como si no hubiera nada. Se apagaban en silencio el 409 de "ya tienes suscripción" (un dueño podía crear una segunda), la validación de excesos al bajar de plan, la reutilización del customer (creaba uno nuevo por intento) y la expiración de la sesión previa. Ahora hay GRANT, la ruta responde 500 si la lectura falla (nunca "como si nada") y hay prueba pgTAP de regresión.
2. **Un pago reactivaba cuentas suspendidas por el admin.** `invoice.paid`/`checkout.session.completed` ponían `active` sin mirar el motivo. Ahora solo levantan suspensiones del sistema (`trial_expired`, `payment_failed`, `subscription_deleted`); las que el admin escribió a mano se respetan y queda `stripe.reactivation_skipped` en la auditoría.
3. La validación de excesos corre antes de la reserva: un 409 por exceso ya no deja al dueño bloqueado 5 min.

**No cubierto (queda para ti, en vivo):**
- Teclear la tarjeta `4242 4242 4242 4242` en la página hospedada de Checkout y volver a `?checkout=success` (la prueba no teclea tarjetas; el resto del camino sí).
- `checkout.session.completed` real (solo tiene pruebas unitarias), `invoice.overdue` real de SPEI (hay que esperar el vencimiento o usar un Test Clock) y disputas.
- Correos de la CLABE (`invoice.finalized`) y de disputas: siguen sin enviarse.
- Smart Retries, recibos por correo de Stripe y la configuración del Portal: son del Dashboard, no del código.

## 8. Checklist antes de modo live

- [ ] Cuenta verificada (RFC, CLABE). OXXO y SPEI activados.
- [ ] Descriptor de cargo con el nombre de la marca (lo que aparece en el estado de cuenta).
- [ ] Webhook live creado con los eventos de §6. Secret en Vercel prod.
- [ ] `stripe-sync` corrido en live. `plans` de prod con los IDs live.
- [ ] Recibos por correo activados, con logo y color de marca en Branding.
- [ ] Política de reembolsos publicada y ligada en Checkout (`consent_collection.terms_of_service`).

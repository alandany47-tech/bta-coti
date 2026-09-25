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

| Método | Cómo | Notas |
|---|---|---|
| Tarjeta | Checkout, suscripción `charge_automatically` | Se cobra solo. 3DS automático. Radar activado con reglas por defecto |
| OXXO | Suscripción `send_invoice` | Ficha con vencimiento de 3 días. **Tope aproximado de 10,000 MXN por pago (verificar)**: el anual de Broker Pro (11,990) no se ofrece por OXXO |
| SPEI | Suscripción `send_invoice` + `customer_balance` (transferencia bancaria) | CLABE virtual por cliente. Se concilia sola. Sin tope práctico |

- En `/panel/facturacion` el cliente elige "Tarjeta (se renueva sola)" o "OXXO / Transferencia (pagas cada periodo)". Se recomienda el anual para OXXO y SPEI.
- Para OXXO y SPEI, las facturas se generan **3 días antes** del fin del periodo (`days_until_due: 3`) y se mandan recordatorios al día −3, al 0 y al +3.

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
| `checkout.session.completed` | Ligar el customer y la suscripción al tenant. Estado → `active` |
| `customer.subscription.created` / `updated` | Sincronizar `subscriptions` (plan, periodo, `cancel_at_period_end`) y `tenants.plan_id` |
| `customer.subscription.deleted` | Estado → `canceled` |
| `invoice.finalized` | OXXO/SPEI: correo propio con la ficha o CLABE + link al `hosted_invoice_url` |
| `invoice.paid` | Estado → `active` y se limpia `status_reason` |
| `invoice.payment_failed` | Estado → `past_due` (7 días de gracia) y aviso |
| `invoice.overdue` | Si pasaron 7 días en `past_due` → `suspended` (`payment_failed`) |
| `charge.dispute.created` | Alerta inmediata al admin (correo + WhatsApp de soporte) y marca en el tenant |

- **Firma verificada** (`STRIPE_WEBHOOK_SECRET`). Tabla `stripe_events(id pk, type, processed_at)` para idempotencia: si el evento ya existe, se responde 200 sin hacer nada.
- Todo cambio de estado pasa por `setTenantStatus()` (auditoría + invalidar caché).
- **Reintentos de tarjeta:** Smart Retries activado (4 intentos en 2 semanas), con la regla de "marcar como unpaid" al final → `suspended`.

## 7. Pruebas

- Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- **Test Clocks** para simular renovación, fallo y cancelación sin esperar un mes.
- Casos obligatorios:
  - Pago con tarjeta OK.
  - Tarjeta rechazada.
  - OXXO pagado.
  - OXXO vencido.
  - SPEI pagado de más o de menos (el saldo queda a favor).
  - Upgrade, downgrade bloqueado por uso, cancelación y disputa.

## 8. Checklist antes de modo live

- [ ] Cuenta verificada (RFC, CLABE). OXXO y SPEI activados.
- [ ] Descriptor de cargo con el nombre de la marca (lo que aparece en el estado de cuenta).
- [ ] Webhook live creado con los eventos de §6. Secret en Vercel prod.
- [ ] `stripe-sync` corrido en live. `plans` de prod con los IDs live.
- [ ] Recibos por correo activados, con logo y color de marca en Branding.
- [ ] Política de reembolsos publicada y ligada en Checkout (`consent_collection.terms_of_service`).

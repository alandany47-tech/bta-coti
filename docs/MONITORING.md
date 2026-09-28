# Monitoreo y alertas

Objetivo: enterarte antes que el cliente. Todo con planes gratuitos.

## 1. Endpoints de salud

| Ruta | Revisa | Respuesta |
|---|---|---|
| `GET /api/health` | La app responde | 200 `{ok:true, version}` |
| `GET /api/health/deep` (header `x-health-token`) | Consulta a Supabase, `HEAD` a un objeto fijo en R2 (se salta si R2 no está configurado); Stripe (`balance.retrieve`, con caché de 5 min) queda pendiente de T20 | 200 si todo está bien; 503 con el detalle si algo falla |

## 2. Uptime (Better Stack Uptime, gratis: 10 monitores, cada 3 minutos)

| Monitor | Tipo | Alerta si |
|---|---|---|
| `dominio.com` | HTTP con keyword (texto del hero) | 2 fallos seguidos |
| `demo.dominio.com` | HTTP con keyword | 2 fallos |
| `/api/health/deep` | HTTP 200 | 2 fallos |
| `media.dominio.com/health.webp` | HTTP 200 | 2 fallos |
| **Heartbeat del cron diario** | El cron hace ping al terminar | No llega en 26 horas |
| **Heartbeat de webhooks de Stripe** | El handler hace ping en cada evento OK | Sin eventos en 72 horas (solo con más de 20 clientes activos) |
| Vencimiento del SSL y del dominio | Integrado | 14 días antes |

- **Canales:** correo + app de Better Stack (push). Opcional: alerta a WhatsApp vía webhook.
- Página de estado pública gratis en `status.dominio.com`.

## 3. Errores (Sentry, plan gratis)

- `@sentry/nextjs` en cliente, servidor y edge. `tenant_id` y `user_id` como tags. **Sin PII** (`sendDefaultPii: false`).
- **Alertas:** error nuevo → correo; más de 20 eventos en 1 hora → correo urgente.
- Source maps subidos en el build de Vercel.

## 4. Negocio (alertas propias, cron diario + correo a admin)

- Webhooks de Stripe fallidos (endpoint en Stripe con errores).
- Disputas nuevas.
- Tenants con más del 90% de su almacenamiento.
- Registros bloqueados por antiphishing (resumen diario: detecta ataques).
- Reportes de abuso abiertos.
- Pruebas que vencen mañana (para seguimiento comercial).

## 5. Logs

- Vercel Logs (Pro: 1 día de retención). Si se necesita más: Log Drain a Better Stack Logs (gratis hasta 3 GB).
- `audit_log` en la DB para todas las acciones sensibles.

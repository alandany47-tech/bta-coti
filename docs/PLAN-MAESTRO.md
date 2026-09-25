# Plan maestro

> v2, 2026-09-25. Reemplaza la v1. El detalle vive en los documentos enlazados.

## 1. Producto

Una plataforma. Cada tenant renta `slug.dominio.com` y su plan activa módulos:

| Módulo | Cliente | Núcleo |
|---|---|---|
| **Servicios** | PyMEs y personas con catálogo chico | Elige ítems, suma cantidades y obtiene la cotización (link + PDF + WhatsApp) |
| **Catálogo** | Negocios que venden por catálogo | Catálogo interactivo personalizable, compartible por link |
| **Broker** | Brokers inmobiliarios | Propiedades (fotos, renders, planos), calculadora financiera, mini-CRM, cotización premium con plantillas |

Todos los módulos incluyen: marca propia (logo y colores), cartera de clientes, historial de cotizaciones, envío por WhatsApp con **mensaje personalizable** y descarga en PDF.

## 2. Planes (MXN al mes, validar)

| Plan | Precio | Módulos | Ítems | Almacenamiento | Usuarios | Plantillas |
|---|---|---|---|---|---|---|
| Esencial | 199 | Servicios | 50 | 500 MB | 1 | 1 |
| Catálogo | 399 | Servicios + Catálogo | 300 | 2 GB | 2 | 2 |
| Broker | 699 | Broker + Servicios | 25 propiedades | 5 GB | 2 | 3 |
| Broker Pro | 1,199 | Todos + API de WhatsApp | 100 propiedades | 15 GB | 5 | Todas |

- **Prueba:** 7 días, sin tarjeta. Durante la prueba se tienen los límites del plan elegido, con tope de 200 MB.
- **Anual:** 2 meses gratis.
- **Extras:** plantilla premium (pago único), adaptación personalizada (cotizada), +5 GB (~99 al mes).
- Los límites viven en `plans.limits`, no en el código.

## 3. Arquitectura

```
dominio.com / *.dominio.com  ──▶  Vercel Pro (Next.js 16)
                                   ├─ /            marketing, precios, registro, login
                                   ├─ /admin       panel interno (nosotros)
                                   ├─ slug./       storefront público del tenant
                                   ├─ slug./panel  panel del tenant (login)
                                   ├─ slug./q/:tk  cotización compartida
                                   └─ Cron diario  vencimiento de pruebas, limpieza de R2
                                        │
               ┌────────────────────────┼─────────────────────┐
               ▼                        ▼                     ▼
   Supabase (Postgres, Auth, RLS)   Stripe (Billing)   Cloudflare R2 + CDN
                                                        (media.dominio.com)
```

- **Vercel Pro:** $20 USD por usuario al mes, e incluye $20 de uso. Hobby prohíbe uso comercial. Hasta donde sé, no hay anualidad con descuento fuera de Enterprise; confirmarlo en vercel.com/pricing antes de pagar.
- **DNS (D11):** un solo dominio comprado en Cloudflare Registrar, con DNS en Cloudflare. Registros:
  - `_acme-challenge` NS → `ns1.vercel-dns.com` y `ns2.vercel-dns.com` (permanentes; sirven para el certificado comodín).
  - `*` y `@` CNAME/A → Vercel, **sin proxy** (nube gris).
  - `media` → dominio personalizado del bucket R2 (con proxy).
- **Supabase:** gratis en desarrollo; Pro ($25 USD) al lanzar.
- **Costo fijo al lanzar:** ~$45 USD al mes (~$850 MXN). Punto de equilibrio: 5 clientes Esencial.
- **Ruteo:** `proxy.ts` resuelve el slug. El estado del tenant se cachea (`unstable_cache` / `use cache` con tag `tenant:<slug>`, que se invalida al cambiar el estado) para no consultar Supabase en cada request.

## 4. Almacenamiento y cuotas

1. **Navegador:** se genera WebP `full` de 2000 px (~300 KB) y `thumb` de 480 px (~40 KB). Planos en PDF de máximo 10 MB. Nunca se suben originales.
2. **`POST /api/media/sign`:** valida sesión, membresía y cuota (`usage.storage_bytes + size ≤ limits.storage_bytes`). Devuelve una URL PUT firmada de R2 (5 minutos, con tamaño y tipo fijos).
3. **El navegador sube directo a R2.**
4. **`POST /api/media/confirm`:** hace `HEAD` a R2 para tomar el tamaño **real** e inserta en `media`. Un trigger actualiza `usage`.
5. **Borrado:** se borra el objeto en R2 y el trigger descuenta. Un cron diario limpia objetos huérfanos.
6. **Llave:** `t/<tenant_id>/<item_id>/<uuid>-{full|thumb}.webp`.

1 GB ≈ 3,000 fotos. R2 cuesta ~$0.015 USD por GB al mes y la salida de datos es gratis.

## 5. Cotizaciones

- Los montos se calculan en el servidor al guardar y quedan congelados en `quotes.snapshot`.
- Se comparten en `slug.dominio.com/q/<token>`: página web premium con la plantilla elegida y contador de vistas.
- **PDF:** se genera en el navegador con react-pdf a partir del snapshot. No se guarda en el servidor.
- **WhatsApp:** link `wa.me` con el mensaje de la plantilla del tenant (ver `DATA-MODEL.md`, `message_templates`). La API oficial queda para Broker Pro en F4.

## 6. Mensaje de WhatsApp personalizable

- En **Panel → Configuración → Mensajes**: un textarea por módulo, chips para insertar variables y vista previa en vivo con datos de ejemplo.
- **Variables:** `{cliente}`, `{negocio}`, `{total}`, `{link}`, `{vendedor}`, `{fecha}`. Broker suma `{propiedad}`, `{unidad}`, `{enganche}`, `{mensualidad}`.
- Máximo 1,000 caracteres, botón "Restaurar mensaje original" y sin HTML.
- Se renderiza en el servidor con reemplazo simple. Una variable desconocida se deja tal cual.

## 7. Pagos

- **Tarjeta:** Stripe Checkout en modo suscripción (se cobra solo cada periodo).
- **OXXO y SPEI:** suscripción con `collection_method: send_invoice`. El cliente paga cada factura; se empuja el plan anual.
- **Webhooks:** `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated|deleted`. Actualizan `subscriptions` y `tenants.status`.
- **Ciclo de estados:** `trialing` → `active` → `past_due` (7 días de gracia) → `suspended` → `canceled` a los 60 días (los medios se borran a los 90).
- **Portal de cliente** de Stripe para cambiar plan o tarjeta y descargar recibos.
- **Alta manual:** `billing_mode = 'manual'` (cobro fuera de Stripe) o se envía un link de Checkout desde el admin.

## 8. Fases

Ver `ROADMAP.md`. En resumen:

| Fase | Contenido |
|---|---|
| F0 | Seguridad + auth + provisión |
| F1 | Infraestructura (Vercel, R2, cuotas) |
| F2 | Pagos + web + onboarding |
| F3 | Módulos Servicios y Catálogo |
| F4 | Premium |

**Se lanza a la venta al cerrar F3.**

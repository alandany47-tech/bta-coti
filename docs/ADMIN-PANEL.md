# Panel de administración interno (`dominio.com/admin`)

## 1. Qué hay hoy (revisado 2026-09-25)

| Existe | Estado |
|---|---|
| Login con Supabase Auth + `app_admins` + `getAdminUser()` | ✔ Sirve, se conserva |
| Tabla de tenants: logo, nombre, subdominio, estado, # propiedades, # cotizaciones, cambiar estado, notas | ✔ Base útil |
| PATCH de estado y notas vía `/api/admin/tenants/[id]` | ✔ Sirve |

**Problemas:**

1. **No se pueden crear clientes.** La alta manual es obligatoria (vía B de `AUTH-ONBOARDING.md`).
2. **Los conteos traen todas las filas** de properties y quotes con la service role y cuentan en JS. No escala; se reemplaza por la tabla `usage`.
3. **Sin plan, uso ni facturación:** no se ve qué paga cada cliente ni cuánto almacenamiento usa.
4. **Cambiar el estado a mano no invalida caché ni deja auditoría**, y puede desincronizarse con Stripe.
5. Tabla única sin búsqueda, filtros ni paginación.

## 2. Cómo debe quedar

**Navegación lateral:** Resumen · Clientes · Planes · Pagos · Auditoría.

### Resumen

- **KPIs:** MRR (suma de planes `active`, los anuales ÷ 12), clientes activos, en prueba, morosos, conversión de prueba a pago (30 días) y almacenamiento total en R2.
- **Listas cortas:** pruebas que vencen en ≤ 2 días y pagos fallidos recientes.

### Clientes (lista)

- **Columnas:** negocio, subdominio, plan, estado, origen (auto/admin), almacenamiento usado / límite (barra), ítems, cotizaciones del mes, alta, vencimiento de prueba o de periodo.
- **Búsqueda** por nombre, slug o email del dueño. **Filtros** por estado, plan y origen. Paginación server-side.
- Botón **"Nuevo cliente"** (vía B).

### Cliente (detalle)

- **Datos:** dueño y miembros, plan, estado con motivo, billing_mode, IDs de Stripe (link al dashboard) y notas internas.
- **Acciones:** cambiar plan, extender prueba (+N días), suspender o reactivar (con motivo obligatorio), reenviar invitación, generar link de Checkout, **entrar como soporte** (solo lectura, se registra en auditoría) y abrir storefront.
- **Uso:** almacenamiento por tipo, ítems y cotizaciones de los últimos 6 meses.
- **Historial:** `audit_log` del tenant.

### Planes

- CRUD de `plans`: precio, límites, módulos y `stripe_price_id`.
- Editar límites **no** requiere deploy. Un plan con clientes no se borra, solo se oculta (`public = false`).

### Pagos

- Suscripciones con `payment_method`, facturas OXXO/SPEI pendientes y fallidas. Los datos vienen de `subscriptions` + webhooks.

### Auditoría

- Toda acción del admin y todo cambio de estado (incluidos los de webhooks y cron).

## 3. Reglas técnicas

- Los cambios de estado pasan por una sola función de servidor, `setTenantStatus(tenantId, status, reason, actor)`: actualiza, escribe en `audit_log` y hace `revalidateTag('tenant:<slug>')`.
- Si el tenant tiene `billing_mode = 'stripe'`, al suspender o reactivar a mano se avisa que Stripe puede sobrescribirlo en el próximo webhook.
- Todas las rutas `/api/admin/*` validan `getAdminUser()` en la primera línea.
- UI según `BRAND.md` (misma línea que el producto, densidad alta).

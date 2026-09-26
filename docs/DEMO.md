# Demo

**Objetivo:** que un prospecto vea y use el producto en menos de 30 segundos, sin registrarse. Además, que sirva para vender en persona a los clientes que ya tienes.

## 1. Tenants de demo

| Subdominio | Módulo | Contenido |
|---|---|---|
| `demo.dominio.com` | Broker (principal) | Desarrollo ficticio "Residencial Almendro" (usar un nombre inventado): 12 unidades (2 reservadas, 1 vendida), 6–8 fotos por unidad, 2 renders, planos, 8 clientes, 15 cotizaciones de ejemplo |
| `demo-servicios.dominio.com` | Servicios | Taller o empresa de mantenimiento ficticia: 30 servicios y productos con precios reales de mercado |
| `demo-catalogo.dominio.com` | Catálogo | Tienda de muebles o decoración: 40 productos en 5 secciones |

- `tenants.is_demo = true`: sin cobro, sin vencimiento, excluidos de los KPIs del admin.
- **Fotos:** Unsplash o Pexels (licencia comercial libre) o renders propios **con permiso por escrito**. Nada que parezca generado por IA. Todo se optimiza a WebP y va a R2.

## 2. Dos modos

1. **Ver (público):** el storefront y una cotización de ejemplo en `/q/demo`. Link desde la web: "Ver demo".
2. **Probar como vendedor:** el botón "Probar el panel" en la web entra automáticamente a un usuario demo (rol `editor`) mediante una ruta `/demo/entrar` que crea la sesión en el servidor. Puede crear cotizaciones, clientes y editar precios.
   - **No puede:** subir o borrar medios, cambiar la configuración de marca, invitar usuarios ni ir a Facturación (se bloquea con `is_demo`).
   - Banner fijo: "Estás en la demo. Los cambios se borran cada noche. **Crear mi cuenta gratis**".
   - WhatsApp permitido (abre `wa.me` en el teléfono del prospecto).

## 3. Reset nocturno

- `scripts/seed-demo.ts`: idempotente. Borra los datos del tenant demo (excepto medios) y vuelve a insertar el JSON de `supabase/seed/demo/*.json`.
- Cron de Vercel a las 3:00 (America/Monterrey), más un botón "Resetear demo" en el admin.
- Rate limit para el usuario demo: 30 cotizaciones por hora por IP.

## 4. Para ventas en persona

- **Modo presentación:** `?present=1` oculta el banner de demo y usa pantalla completa. Pensado para enseñarlo en una tablet o laptop con el cliente.
- Tenant demo **personalizable al vuelo** desde el admin: "Clonar demo como `prospecto-x`", con su logo y color, en estado `trialing` de 7 días. Sirve para la reunión con un cliente que ya tienes: le muestras *su* cotizador.

## 4.1 Usuarios y tenants de demo por suscripción (adelanto de T26)

`npm run seed:demo` (o `DEMO_PASSWORD=... npm run seed:demo`; `-- --rollback` valida sin dejar nada) recrea 8 tenants con `is_demo = true`, cada uno con datos propios, y usuarios `rol.plan@demo.ayx.test` con una sola contraseña (aleatoria si no pasas `DEMO_PASSWORD`; se imprime al final). Los datos viven en `supabase/seed/demo.sql` (idempotente) y la lista de cuentas en `supabase/seed/demo-accounts.json`.

| Subdominio | Negocio de ejemplo | Plan · estado | Usuarios |
|---|---|---|---|
| `demo-esencial` | Plomería Garza (12 servicios y materiales) | Esencial · activo | owner |
| `demo-catalogo` | Muebles Nogal (14 productos, 4 categorías) | Catálogo · activo | owner, editor |
| `demo-broker` | Residencial Almendro (12 unidades, 2 apartadas, 1 vendida; 4 cotizaciones) | Broker · activo | owner, editor, viewer |
| `demo-brokerpro` | Grupo Vértice Inmobiliario (24 unidades, 6 cotizaciones) | Broker Pro · activo | owner, editor |
| `demo-prueba` | Casa Lomas Residencial (5 casas) | Broker · en prueba 7 días | owner |
| `demo-morosa` | Boutique Aurora | Catálogo · `past_due` | owner |
| `demo-suspendida` | Taller Mecánico Rivas | Esencial · suspendido (muestra el bloqueo) | owner |
| `demo-cancelada` | Inmobiliaria Sol Naciente | Broker · cancelado (404) | owner |

Hoy el storefront y el cotizador solo pintan propiedades (Servicios y Catálogo llegan en T30 y T32), así que los tenants de servicios/productos ya tienen sus ítems cargados pero sin pantalla propia. Las fotos son placeholders de picsum.photos.

## 5. Ticket

- **T26 (CC):** `is_demo`, seeds, `/demo/entrar`, restricciones, cron de reset, clonar demo desde el admin.
- Se construye apenas terminen T15 y T16: **es lo primero después de F1**, porque los clientes ya están esperando.

# Demo

**Objetivo:** que un prospecto vea y use el producto en menos de 30 segundos, sin registrarse. Además, que sirva para vender en persona a los clientes que ya tienes.

## 1. Tenants de demo

**Decisión de T26** (se aparta de una versión anterior de este documento): `demo` está en la lista
de slugs reservados (`is_slug_reserved`, docs/AUTH-ONBOARDING.md), así que no puede ser el
subdominio de un tenant real. En vez de `demo.dominio.com`/`demo-servicios.dominio.com`, la demo
usa los 8 tenants `demo-*` de la tabla de la §4, uno por plan y estado — ya cubren Broker, Broker
Pro, Servicios (Esencial) y Catálogo. `demo-broker` ("Residencial Almendro") es la vitrina
principal: es la que abre `/demo/entrar`.

- `tenants.is_demo = true`: sin cobro, sin vencimiento, excluidos de la lista de clientes y del
  contador del admin (viven en su propia sección "Demo").
- **Fotos:** placeholders de picsum.photos (ver §4). Antes de un lanzamiento real, cambiar por
  Unsplash/Pexels (licencia comercial) o renders propios con permiso por escrito.

## 2. Dos modos

1. **Ver (público):** el storefront de cualquier tenant `demo-*` ya es público
   (`demo-broker.ayx.solutions`). No hay un enlace de cotización de ejemplo con token corto
   (`/q/demo`): el token de una cotización siempre es largo e impredecible (T15), así que un
   enlace de ejemplo usa el token real de una de las cotizaciones ya sembradas en `demo-broker`.
2. **Probar como vendedor:** `/demo/entrar` (dominio raíz) entra automáticamente como el usuario
   `editor` de `demo-broker` — sesión compartida por todos los visitantes, con `DEMO_PASSWORD`
   (mismo valor que sembró `reset_demo_data`). Redirige a `demo-broker.<dominio>/panel`. Puede
   crear cotizaciones, clientes y editar precios.
   - **No puede:** subir ni borrar medios (`is_demo` lo bloquea en `/api/media/sign`,
     `DELETE /api/media/[id]` y, para quitar fotos o el plano, en
     `PUT /api/[tenant]/properties/[propertyId]/images`; reordenar sí). La base lo respalda con el
     trigger `items_demo_media_guard` (0021) para quien use la sesión directo por REST. Cambiar marca, invitar usuarios y Facturación quedan bloqueados el
     día que existan (T23/T24/T21 aún no están construidos).
   - Banner fijo en el panel: "Estás en la demo. Los cambios se borran cada noche. **Crear mi
     cuenta gratis**" (`components/demo-banner.tsx`).
   - Límite extra por IP: 20 entradas/min a `/demo/entrar` y 30 cotizaciones/hora (bucket `demo` y
     `demo_quote` en `lib/rate-limit.ts`), aparte del tope diario normal del plan.
   - WhatsApp permitido (abre `wa.me` con la plantilla de T16).

## 3. Reset

- `public.reset_demo_data(password)` (migración `0020_demo.sql`): borra los 8 tenants `demo-*` y
  sus usuarios y los vuelve a crear desde cero, siempre iguales. La llaman tres caminos:
  - `npm run seed:demo` (`DEMO_PASSWORD` obligatoria en el entorno; `-- --rollback` valida sin
    dejar nada) — lo corre Alan a mano.
  - Cron de Vercel diario a las 3:00 America/Monterrey (`/api/cron/reset-demo`, `vercel.json`).
  - Botón "Resetear demo" en `/admin`.
- `DEMO_PASSWORD` debe ser la misma en el seed y en la app (`.env.local`/Vercel): es la que usa
  `/demo/entrar` para iniciar sesión.

## 4. Para ventas en persona

- **Modo presentación:** `?present=1` en cualquier URL del panel oculta el banner de demo
  (`components/demo-banner.tsx` lo lee del lado del cliente). Pensado para enseñarlo en una
  tablet o laptop con el cliente.
- **Clonar demo como prospecto:** en `/admin`, sección "Demo" → "Clonar como prospecto" en
  cualquier tenant `demo-*`. Copia su catálogo (`items`, sin clientes ni cotizaciones) y su marca
  (logo, color) a un tenant nuevo, real, en `trialing` de 7 días, con el dueño que escribas
  (invitación si no tiene cuenta). Sirve para la reunión con un cliente que ya tienes: le muestras
  *su* cotizador. `POST /api/admin/tenants/[tenantId]/clone` → `clone_demo_tenant()` (0021): alta y
  copia del catálogo en una sola transacción, así que si la copia falla (p. ej. el catálogo no cabe
  en los topes del plan) no queda un tenant vacío con el slug ocupado, y se puede reintentar.

## 4.1 Usuarios y tenants de demo por plan y estado

| Subdominio | Negocio de ejemplo | Plan · estado | Usuarios |
|---|---|---|---|
| `demo-esencial` | Plomería Garza (12 servicios y materiales) | Esencial · activo | owner |
| `demo-catalogo` | Muebles Nogal (14 productos, 4 categorías) | Catálogo · activo | owner, editor |
| `demo-broker` | Residencial Almendro (12 unidades, 2 apartadas, 1 vendida; 4 cotizaciones) — **vitrina principal** | Broker · activo | owner, editor, viewer |
| `demo-brokerpro` | Grupo Vértice Inmobiliario (24 unidades, 6 cotizaciones) | Broker Pro · activo | owner, editor |
| `demo-prueba` | Casa Lomas Residencial (5 casas) | Broker · en prueba 7 días | owner |
| `demo-morosa` | Boutique Aurora | Catálogo · `past_due` | owner |
| `demo-suspendida` | Taller Mecánico Rivas | Esencial · suspendido (muestra el bloqueo) | owner |
| `demo-cancelada` | Inmobiliaria Sol Naciente | Broker · cancelado (404) | owner |

Hoy el storefront y el cotizador solo pintan propiedades (Servicios y Catálogo llegan en T30 y T32), así que los tenants de servicios/productos ya tienen sus ítems cargados pero sin pantalla propia. Las fotos son placeholders de picsum.photos. La lista de cuentas vive en `supabase/seed/demo-accounts.json` (solo referencia; los datos reales los crea `reset_demo_data`, no ese archivo).

## 5. Ticket

- **T26 (CC):** `is_demo`, `reset_demo_data`, `/demo/entrar`, restricciones, cron de reset, clonar demo desde el admin. ✅

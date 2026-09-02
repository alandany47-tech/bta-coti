@AGENTS.md

# BTA Cotiza

Cotizador multi-tenant para brokers inmobiliarios de lujo (cartera de hasta
10 propiedades por tenant, vía Excel + fotos/plano en Supabase Storage),
calculadora financiera en tiempo real, mini-CRM de clientes, dossier en PDF
de 2 páginas y envío por WhatsApp. Ver [README.md](./README.md) para la
arquitectura completa y cómo levantar el proyecto.

## Convenciones específicas de este repo

- **Next.js 16, no 14.** `middleware.ts` no existe en esta versión: el
  archivo se llama [`proxy.ts`](./proxy.ts) y exporta `proxy()` en vez de
  `middleware()`. Antes de tocar rutas, App Router o config, revisa
  `node_modules/next/dist/docs/` (AGENTS.md ya lo recuerda arriba).
- **Multi-tenant por subdominio**: `proxy.ts` reescribe `cliente1.localhost:3000`
  o `cliente1.btacotiza.com` a `/[tenant]/...`. No inventes rutas `/tenant/`
  con path prefix manual: el slug siempre viaja en el subdominio.
- **Dos clientes de Supabase, a propósito** ([lib/supabase/server.ts](./lib/supabase/server.ts)):
  anon key para lecturas públicas (respeta RLS), service role SOLO dentro de
  Route Handlers (`app/api/[tenant]/...`) para escrituras. Nunca insertes
  propiedades/clientes/cotizaciones desde el cliente con la anon key.
- **`clients` es PII, sin lectura pública**: a diferencia de `properties`
  (RLS permite `select` público de tenants activos, igual que el catálogo
  original), `clients` no tiene ninguna policy de select/insert para
  anon/authenticated. El mini-CRM del cotizador siempre busca/crea clientes
  vía [`/api/[tenant]/clients`](./app/api/[tenant]/clients/route.ts)
  (service role), nunca con la anon key desde el navegador.
- **Sin auth todavía**: el import de cartera, la carga de medios y el alta de
  cotizaciones no requieren login (fuera de alcance del MVP). Si se agrega
  auth por tenant, hay que revisar las políticas RLS en
  [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql) y
  [0002_real_estate_upgrade.sql](./supabase/migrations/0002_real_estate_upgrade.sql)
  (esta última corre las tablas de `products`→`properties`, agrega `clients`
  y extiende `quotes` con el desglose financiero — aplícala siempre después
  de 0001, en ese orden).
- **PDF en runtime Node**: `@react-pdf/renderer` no corre en Edge. La ruta
  `app/api/[tenant]/quotes/route.ts` declara `export const runtime = "nodejs"`;
  no lo quites. El dossier ([pdf/QuoteDocument.tsx](./pdf/QuoteDocument.tsx))
  recalcula el precio/desglose en el servidor con
  [lib/pricing.ts](./lib/pricing.ts) — nunca confíes en los montos que manda
  el navegador.
- **Paleta fija dark en la app**: negro `#09090B` / grises `#18181B`,
  `#27272A`, `#71717A` / blanco `#FAFAFA` / gris claro `#E4E4E7`, definida
  como CSS vars en `app/globals.css`. No se soporta light mode; `<html>`
  fuerza `dark`. El PDF es la excepción intencional: página 1 es fondo claro
  (documento imprimible) con bloques de acento oscuro, página 2 (galería) es
  full-dark — no "corrijas" esto para que combine con `globals.css`.
- **Storage**: dos buckets públicos — `quotes` (PDFs generados) y
  `property-media` (hasta 10 imágenes + 1 plano por propiedad, creado en
  0002). Las subidas de medios pasan por
  [`/api/[tenant]/properties/[propertyId]/media`](./app/api/[tenant]/properties/[propertyId]/media/route.ts)
  (valida 5MB server-side, no solo en el cliente).

## Entorno local

- Variables en `.env.local` (ver [.env.example](./.env.example)): 3 keys de
  Supabase + `NEXT_PUBLIC_ROOT_DOMAIN`.
- Las keys de Supabase de este proyecto usan el formato nuevo
  (`sb_publishable_...` para `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `sb_secret_...` para `SUPABASE_SERVICE_ROLE_KEY`), no el JWT legacy
  (`eyJ...`) que muestra `.env.example` como placeholder. Ambos formatos
  funcionan igual con el SDK, no asumas que una key sin prefijo `eyJ` está mal.
- Si trabajas en esta máquina junto con el proyecto `admin-inmobiliario`, ese
  repo también usa el puerto 3000 por defecto — arranca este con
  `PORT=<otro-puerto> npm run dev` si ambos corren a la vez.
- En esta máquina suele quedar un `next dev` de este proyecto corriendo en
  segundo plano en el puerto **4000** (fuera de `.claude/launch.json`, que
  usa 3100). Si al levantar el dev server ves "Another next dev server is
  already running" con PID y puerto 4000, no es un error: apuntá el
  navegador directo a `http://localhost:4000` en vez de matar ese proceso.
  Ojo: como los env vars se cargan una sola vez al arrancar `next dev`, ese
  proceso puede quedar con keys de Supabase viejas si `.env.local` cambió
  después (pasó en la migración a real estate: seguía con las keys
  pre-rotación y toda ruta que consultaba Supabase devolvía "Tenant no
  encontrado" aunque el tenant existiera). Si ves ese síntoma con datos que
  sabes que existen, el proceso está obsoleto — ahí sí mátalo y levanta uno
  nuevo (`npm run dev` o el preview del harness) para que tome el
  `.env.local` actual.
- `xlsx` (SheetJS) tiene un advisory de seguridad conocido sin fix oficial;
  ver README para el detalle antes de ir a producción.

# BTA Cotiza

Cotizador multi-tenant para PyMEs: importan su catálogo desde Excel, arman una
cotización con precios fijos o editables, generan un PDF y lo envían por
WhatsApp con un solo clic.

## Stack

- Next.js 16 (App Router, TypeScript) — nota: en esta versión `middleware.ts`
  se llama `proxy.ts` (ver [`proxy.ts`](./proxy.ts)).
- Tailwind CSS v4 + paleta dark minimalista (`app/globals.css`).
- Supabase (Postgres + RLS + Storage) como backend.
- `@react-pdf/renderer` para generar el PDF en memoria (Route Handler, runtime Node).
- `xlsx` (SheetJS) para parsear el Excel en el navegador.

## Arquitectura multi-tenant

- `proxy.ts` lee el header `Host`, extrae el subdominio (`cliente1.btacotiza.com`
  o `cliente1.localhost:3000`) y reescribe internamente a `/[tenant]/...`.
- `app/[tenant]/layout.tsx` resuelve el tenant por slug contra Supabase y
  devuelve 404 si no existe o está inactivo.
- Las escrituras (import de catálogo, alta de cotizaciones) pasan por Route
  Handlers (`app/api/[tenant]/...`) que usan la **Service Role Key** de
  Supabase — nunca se expone esa key al cliente. RLS protege la vía pública
  (anon key) que solo puede leer catálogo de tenants activos.

## Poner en marcha

1. Crea un proyecto en Supabase y corre la migración:
   ```bash
   supabase db push
   # o pega el contenido de supabase/migrations/0001_init.sql en el SQL Editor
   ```
2. Copia `.env.example` a `.env.local` y completa las 3 keys de Supabase.
3. Instala dependencias y levanta el dev server:
   ```bash
   npm install
   npm run dev
   ```
4. Crea un tenant de prueba (tabla `tenants`) y visita
   `http://<slug>.localhost:3000`.

## Estructura

```
app/
  page.tsx                    landing del dominio raíz
  [tenant]/
    layout.tsx                resuelve tenant, header con logo/marca
    page.tsx                  Cotizador (core)
    catalog/page.tsx          import de catálogo vía Excel
  api/[tenant]/
    quotes/route.ts           genera PDF + sube a Storage + inserta quote
    products/import/route.ts  upsert masivo de productos
components/
  ui/                         primitivos estilo shadcn (Button, Input, Card, Select)
  cotizador/                  buscador de productos, tabla de ítems, form de cliente
  catalog/                    dropzone de Excel
lib/
  supabase/                   clientes browser / server / service-role
  tenants.ts, types.ts, whatsapp.ts, utils.ts
pdf/QuoteDocument.tsx          plantilla @react-pdf/renderer
supabase/migrations/0001_init.sql
proxy.ts                       enrutamiento por subdominio (multi-tenant)
```

## Pendiente para producción

- Auth/roles por tenant (hoy el catálogo y las cotizaciones no requieren login).
- Paginación/búsqueda server-side si el catálogo crece de unos cientos de SKUs.
- El paquete `xlsx` de npm tiene un advisory de seguridad conocido sin fix
  oficial; evaluar la build de SheetJS CDN si esto va a producción real.

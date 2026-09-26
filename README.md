# AYX Cotiza

Cotizador multi-tenant para brokers inmobiliarios de lujo (cartera de hasta 10
propiedades por tenant): importan su cartera desde Excel, suben fotos y plano
por propiedad, arman una cotización con calculadora financiera en tiempo real
(enganche, mensualidades, saldo a escrituración) y mini-CRM de clientes,
generan un dossier en PDF de 2 páginas y lo envían por WhatsApp con un solo
clic.

## Stack

- Next.js 16 (App Router, TypeScript) — nota: en esta versión `middleware.ts`
  se llama `proxy.ts` (ver [`proxy.ts`](./proxy.ts)).
- Tailwind CSS v4 + paleta dark minimalista (`app/globals.css`).
- Supabase (Postgres + RLS + Storage) como backend.
- `@react-pdf/renderer` para generar el PDF en memoria (Route Handler, runtime Node).
- `xlsx` (SheetJS) para parsear el Excel en el navegador.

## Arquitectura multi-tenant

- `proxy.ts` lee el header `Host`, extrae el subdominio (`cliente1.ayx.solutions`
  o `cliente1.localhost:3000`) y reescribe internamente a `/[tenant]/...`.
- `app/[tenant]/layout.tsx` resuelve el tenant por slug contra Supabase y
  devuelve 404 si no existe o está inactivo.
- Las escrituras (import de cartera, medios de propiedades, alta/búsqueda de
  clientes, alta de cotizaciones) pasan por Route Handlers (`app/api/[tenant]/...`)
  que usan la **Service Role Key** de Supabase — nunca se expone esa key al
  cliente. RLS protege la vía pública (anon key), que solo puede leer
  propiedades y datos de tenant de tenants activos; `clients` (PII) no tiene
  policies de lectura pública, solo se accede vía Route Handlers.

## Poner en marcha

1. Crea un proyecto en Supabase y corre las migraciones en orden:
   ```bash
   supabase db push
   # o pega el contenido de supabase/migrations/0001_init.sql y luego
   # 0002_real_estate_upgrade.sql en el SQL Editor, en ese orden
   ```
2. Copia `.env.example` a `.env.local` y completa las 3 keys de Supabase.
3. Instala dependencias y levanta el dev server:
   ```bash
   npm install
   npm run dev
   ```
4. Crea un tenant con `provision_tenant` (o desde `/admin`), inicia sesión en
   `http://localhost:3000/login`, importa propiedades desde
   `http://<slug>.localhost:3000/panel/importar` (Excel) y visita
   `http://<slug>.localhost:3000` (storefront público).

## Estructura

```
app/
  page.tsx                     landing del dominio raíz
  [tenant]/
    layout.tsx                 resuelve el tenant
    (public)/page.tsx          storefront público de solo lectura
    panel/layout.tsx           gate de sesión y membresía, navegación por rol
    panel/page.tsx             Cotizador (core): selector de cartera,
                                calculadora financiera, mini-CRM
    panel/propiedades/page.tsx carga de fotos (hasta 10) y plano por propiedad
    panel/importar/page.tsx    import masivo de cartera vía Excel
  api/[tenant]/
    quotes/route.ts                       recalcula precios, genera el
                                           dossier PDF de 2 páginas, sube a
                                           Storage e inserta la cotización
    properties/import/route.ts            upsert masivo de propiedades
    properties/[propertyId]/media/route.ts  sube/borra imágenes y plano
    clients/route.ts                      búsqueda y alta de clientes (mini-CRM)
components/
  ui/                          primitivos estilo shadcn (Button, Input, Card, Select, Slider)
  cotizador/                   selector de propiedades, calculadora financiera,
                                combobox de clientes
  properties/                  gestor de medios por propiedad (fotos + plano)
  catalog/                     dropzone de Excel
lib/
  supabase/                    clientes browser / server / service-role
  pricing.ts                   motor de cálculo financiero (enganche,
                                mensualidades, saldo a escrituración)
  uploads.ts                   validación de imágenes (tamaño/tipo) en el cliente
  tenants.ts, types.ts, whatsapp.ts, utils.ts
pdf/QuoteDocument.tsx           dossier @react-pdf/renderer (ficha financiera +
                                galería/plano)
supabase/migrations/
  0001_init.sql                 esquema inicial (tenants, catálogo genérico, quotes)
  0002_real_estate_upgrade.sql  pivote a propiedades + clients + desglose financiero
proxy.ts                        enrutamiento por subdominio (multi-tenant)
```

## Pendiente para producción

- Auth/roles por tenant (hoy la cartera y las cotizaciones no requieren login).
- Paginación/búsqueda server-side si la cartera crece más allá de las ~10
  propiedades pensadas para el nicho de lujo.
- El paquete `xlsx` de npm tiene un advisory de seguridad conocido sin fix
  oficial; evaluar la build de SheetJS CDN si esto va a producción real.

@AGENTS.md

# BTA Cotiza

Cotizador multi-tenant para PyMEs (catálogo vía Excel, cotización en PDF,
envío por WhatsApp). Ver [README.md](./README.md) para la arquitectura
completa y cómo levantar el proyecto.

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
  productos/cotizaciones desde el cliente con la anon key.
- **Sin auth todavía**: el import de catálogo y el alta de cotizaciones no
  requieren login (fuera de alcance del MVP). Si se agrega auth por tenant,
  hay que revisar las políticas RLS en
  [supabase/migrations/0001_init.sql](./supabase/migrations/0001_init.sql).
- **PDF en runtime Node**: `@react-pdf/renderer` no corre en Edge. La ruta
  `app/api/[tenant]/quotes/route.ts` declara `export const runtime = "nodejs"`;
  no lo quites.
- **Paleta fija dark**: negro `#09090B` / grises `#18181B`, `#27272A`,
  `#71717A` / blanco `#FAFAFA` / gris claro `#E4E4E7`, definida como CSS vars
  en `app/globals.css`. No se soporta light mode; `<html>` fuerza `dark`.

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
  already running" con PID y puerto 4000, no es un error: no mates ese
  proceso, apuntá el navegador directo a `http://localhost:4000`.
- `xlsx` (SheetJS) tiene un advisory de seguridad conocido sin fix oficial;
  ver README para el detalle antes de ir a producción.

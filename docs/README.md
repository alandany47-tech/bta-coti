# Documentación del proyecto (leer primero)

> Nombre: **AYX Cotiza** (definido por el dueño del producto; dominio ayx.solutions) (ver `BRAND.md` §1).
> Estos documentos describen el **estado objetivo**. Si algo del código actual o de `CLAUDE.md` los contradice, mandan estos documentos.

## Orden de lectura para agentes (Claude Code / Codex)

| # | Archivo | Para qué |
|---|---|---|
| 1 | `PLAN-MAESTRO.md` | Producto, planes, arquitectura, decisiones cerradas |
| 2 | `DATA-MODEL.md` | Esquema SQL objetivo, RLS y triggers |
| 3 | `AUTH-ONBOARDING.md` | Registro, login y cómo se liga usuario ↔ tenant (autoregistro y alta manual) |
| 4 | `ADMIN-PANEL.md` | Panel interno: qué hay, qué falta, cómo debe quedar |
| 5 | `BRAND.md` | Identidad, tokens, tipografía, motion, voz y reglas anti-"hecho con IA" |
| 6 | `WEB.md` | Sitio de marketing, registro y pago |
| 7 | `ROADMAP.md` | Tickets por fase con criterios de aceptación |
| 8 | `PROMPTS.md` | Prompts listos para pegar en Claude Code / Codex por ticket |
| 9 | `DECISIONS.md` | Registro de decisiones (qué, por qué y cuándo) |
| 10 | `BUILD-WORKFLOW.md` | Quién construye, conexión Codex ↔ Claude Code, modelos, gates de prueba, reglas de producción |
| 11 | `STRIPE.md` | Cobros, métodos, webhooks, cambios de plan |
| 12 | `ABUSE-AND-LIMITS.md` | Topes de gasto, límites por plan, rate limits, antiphishing |
| 13 | `MONITORING.md` | Uptime, errores, alertas |
| 14 | `DEMO.md` | Tenants demo, modo prueba, reset, clonar para prospectos |
| 15 | `LAUNCH-CHECKLIST.md` | Todo lo que debe estar listo antes de producción y de vender |

## Reglas para cualquier agente

0. **Flujo, modelos y gates en `BUILD-WORKFLOW.md`.** Ningún ticket se cierra sin `/codex:review`.
1. **Un ticket = una rama = un PR.** Nombre de rama: `f<fase>/<id>-<slug>`, por ejemplo `f0/T02-tenant-auth`.
2. Antes de tocar Next.js, leer `node_modules/next/dist/docs/` (Next 16: `proxy.ts`, no `middleware.ts`).
3. Nunca usar la service role fuera de: webhooks de Stripe, cron, `/api/admin/*` y la función de provisión.
4. Toda tabla nueva lleva `tenant_id`, RLS activado y policy por `is_member(tenant_id)`.
5. Toda UI sigue `BRAND.md`. Antes de entregar UI, correr las skills de diseño (ver `BRAND.md` §9).
6. Al cerrar un ticket: actualizar `ROADMAP.md` (estado) y, si cambió una decisión, `DECISIONS.md`.
7. Migraciones numeradas en `supabase/migrations/NNNN_nombre.sql` y **nunca editar una ya aplicada**.
8. Tipos generados con `supabase gen types typescript` en `lib/database.types.ts`.
9. Español de México en UI, commits en español: `tipo(área): descripción`.

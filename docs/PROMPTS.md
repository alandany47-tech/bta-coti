# Prompts para Claude Code y Codex

> Copiar y pegar. Reemplazar `<ID>` por el ticket de `ROADMAP.md`. Todos asumen que el agente está en la raíz del repo.

## 0. Prompt base (anteponer siempre)

```
Lee docs/README.md y sigue su orden de lectura antes de escribir código.
Vas a ejecutar el ticket <ID> de docs/ROADMAP.md. Respeta sus criterios de aceptación al pie de la letra.
Reglas: Next.js 16 (lee node_modules/next/dist/docs antes de tocar rutas o proxy), RLS en toda tabla nueva,
service role solo donde lo permite docs/README.md, UI según docs/BRAND.md.
Trabaja en la rama f<fase>/<ID>-<slug>. Empieza en plan mode y espera mi aprobación. Al terminar: corre lint, typecheck y tests,
luego /codex:review (y /codex:adversarial-review si el ticket es sensible según BUILD-WORKFLOW.md), corrige los hallazgos,
abre el PR con una sección "Cómo probar" de ≤ 10 pasos, marca el ticket como ✅ en ROADMAP.md
y resume en 5 líneas qué cambió y cómo probarlo.
Si una decisión no está en los docs, detente y pregunta antes de inventarla.
```

## 1. Ticket de base de datos (T01, T12, T14…)

```
Implementa la migración del ticket <ID> según docs/DATA-MODEL.md en supabase/migrations/NNNN_<nombre>.sql.
No edites migraciones existentes. Incluye: tablas, índices por tenant_id, RLS con el patrón de DATA-MODEL §4,
funciones security definer con search_path fijo y tests en supabase/tests/<nombre>.sql (pgTAP) que prueben:
aislamiento entre dos tenants, bloqueo de anon y límites del plan. Regenera lib/database.types.ts.
```

## 2. Ticket de UI (T13, T16, T21, T22, T23…)

```
Construye la UI del ticket <ID>. Antes de empezar, lee docs/BRAND.md completo.
Usa componentes de components/ui (shadcn re-tematizado), tokens CSS (nada de hex sueltos) e íconos Lucide de 1.5 de stroke.
Motion según BRAND §7. Al terminar, corre la skill impeccable para auditar la pantalla, corrige lo que marque
y verifica el checklist anti-IA de BRAND §9. Adjunta capturas en móvil (390 px) y escritorio (1440 px).
```

## 3. Ticket de integración (T20 Stripe, T12 R2, T25 Resend)

```
Integra <servicio> para el ticket <ID> según docs/PLAN-MAESTRO.md §<n>.
Credenciales solo en variables de entorno (agrégalas a .env.example con un comentario). Webhooks idempotentes
(guarda event.id procesados), con verificación de firma y handler en runtime nodejs.
Escribe un script en scripts/ para probar localmente (Stripe CLI / curl) y documenta los pasos en el PR.
```

## 4. Revisión de PR (usar con el otro agente)

```
Revisa el PR de la rama <rama> contra docs/ROADMAP.md (ticket <ID>) y docs/README.md.
Busca: uso indebido de la service role, tablas sin RLS, montos calculados en el cliente, textos que violen BRAND §3,
UI que viole BRAND §9 y criterios de aceptación no cumplidos. Responde con una lista priorizada y sin reescribir el código.
```

## 5. Diseño en Figma

```
Con la skill figma-generate-library, crea en Figma el sistema de tokens de docs/BRAND.md §4–7 (variables de color,
tipografía, espaciado y radios) y los componentes base de §8. Después, con figma-generate-design, arma estas pantallas:
Home (WEB §2), Precios, Panel → Nueva cotización y Cotización compartida (/q). Solo con tokens, sin valores sueltos.
```

## 6. (Reserva) Delegar a Codex: no se usa por cuota; solo para un bug atorado

```
/codex:rescue Ejecuta el ticket <ID> de docs/ROADMAP.md en la rama f<fase>/<ID>-<slug> (worktree aparte).
Lee docs/README.md, docs/BRAND.md y los docs que cite el ticket. No hagas merge ni migraciones. Deja el PR listo con "Cómo probar".
```

## 7. Arranque del día 1 (mañana)

```
Ejecuta T00, después T01 y después T18 de docs/ROADMAP.md, en ese orden y en PRs separados. [Prompt base]
```

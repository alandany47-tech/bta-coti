# Flujo de construcción: quién, cómo y con qué modelo

## 1. Roles

| Quién | Rol | Hace |
|---|---|---|
| **Alan** | Product owner | Crea cuentas y llaves, lanza cada ticket, **prueba cada gate** y aprueba el merge a `main` |
| **Claude Code** | Constructor líder y orquestador | Implementa todos los tickets, corre tests, pide revisión a Codex, corrige y abre el PR |
| **Codex** (vía plugin dentro de Claude Code) | **Solo revisor** (plan de 20 USD: cuidar la cuota) | `/codex:review` en cada PR; `/codex:adversarial-review` solo en T01, T03, T18 y T20. **No implementa tickets** |
| **Claude (Cowork)** | Documentación | Mantiene `docs/` al día cuando cambia una decisión |

**Regla:** Codex nunca hace merge ni corre migraciones. Solo Claude Code, con tu aprobación.

## 2. Conexión Codex ↔ Claude Code ([openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc))

Una sola vez, en tu Mac:

```bash
npm install -g @openai/codex        # requiere Node ≥ 18.18
codex login                         # con tu cuenta de ChatGPT
```

Dentro de Claude Code, en el repo:

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

| Comando | Cuándo se usa aquí |
|---|---|
| `/codex:review` | **En todo ticket**, antes de abrir el PR |
| `/codex:adversarial-review` | Solo T01, T03, T18 y T20 (lo más crítico), con effort `high` |
| `/codex:rescue` | **No se usa**, para cuidar la cuota. Solo como último recurso ante un bug atorado |
| `/codex:status` · `/codex:result` · `/codex:cancel` | Seguir los trabajos en segundo plano |

**Nota:** el plugin usa tu Codex CLI **local**. En las sesiones en la nube de Claude Code (créditos que vencen el 5) no está disponible. Esas sesiones construyen, y la revisión con Codex se hace después en local.

## 3. Modelos

| Herramienta | Modelo | Uso |
|---|---|---|
| Claude Code | **Opus** (el más reciente de tu plan) | Por defecto en todo: DB, auth, Stripe, arquitectura, revisión final |
| Claude Code | **Sonnet** (el más reciente) | Solo UI repetitiva y ajustes menores, si quieres cuidar límites (`/model` para cambiar) |
| Codex | **GPT-5.6**, effort `medium` por defecto; `high` solo en las revisiones adversariales | Solo revisión |

Configurar Codex por proyecto en `.codex/config.toml` (confirmar el nombre exacto del modelo con `/model` dentro de `codex`):

Ya existe en el repo: `.codex/config.toml` (`gpt-5.6`, `medium`).

## 4. Ciclo de cada ticket

```
1. Alan    → en Claude Code: pega el prompt base de PROMPTS.md con el ID del ticket
2. CC      → plan mode: propone el plan; Alan lo aprueba
3. CC      → rama f<fase>/<ID>-<slug>, implementa, lint + typecheck + tests
4. CC      → /codex:review  (o /codex:adversarial-review si es sensible)
5. CC      → corrige hallazgos y abre el PR con "Cómo probar" (≤ 10 pasos)
6. Vercel  → deploy preview automático
7. Alan    → prueba en el preview con los pasos del PR
8. Alan    → aprueba → merge a main → producción
9. CC      → si hay migración: supabase db push (después del merge, nunca antes)
10. CC     → marca ✅ en ROADMAP.md
```

**Todos los tickets los implementa Claude Code**, incluidos los marcados CX. Para paralelizar, se abren sesiones de Claude Code en la nube (una por ticket, en otra rama).

## 5. Todo directo en producción (hasta el primer cliente que paga)

Está bien porque no hay clientes, con estas reglas:

- **Un solo proyecto de Supabase (prod) desde el día 1.** Esquema solo por migraciones del repo (`supabase db push`). **Nunca SQL a mano en el dashboard.**
- **Antes de cada migración destructiva** (drop, rename, cambio de tipo): `scripts/db-backup.sh` (pg_dump a tu Mac).
- **Stripe en modo test** hasta el Gate 4. Resend y R2 ya en prod.
- `main` = producción en Vercel. Los previews apuntan a la misma base, así que **ningún preview corre seeds ni borra datos**.
- **Riesgo:** una migración mala tira todo. Hoy da igual; con clientes, no. Por eso el Gate 4 cambia las reglas.

**Gate 4 (salida a venta):** Supabase Pro con backups, Stripe live, rotar llaves y monitoreo activo. **A partir de ahí** se crea staging (Supabase Branching o un segundo proyecto) y ya no se prueba en prod.

## 6. Fases con gates de prueba

| Gate | Tras | Alan prueba (manual, ~20 min) | Resultado |
|---|---|---|---|
| **G0** | T00–T05 + T18 | Registrarse con un slug normal (✔) y con `bbva-pagos` o `s4ntander` (✖ bloqueado). Login. Alta de un cliente desde el admin, que recibe la invitación y entra. Un usuario de A no ve ni edita B. Sin sesión no se puede escribir | Base segura |
| **G1** | T10–T17 | Subir 10 fotos (se ven rápido y el uso sube). Llenar la cuota → mensaje claro. Crear cotización broker → link `/q/` → PDF en iPhone → WhatsApp con mensaje personalizado | Producto usable |
| **G2** | T26 (demo) + T19 (monitoreo) | Demo pública y "Probar el panel". Reset nocturno. Clonar demo para un prospecto. Apagar Supabase de mentira (llave mala) → llega la alerta | **Se puede empezar con tus clientes como pilotos, con cobro manual (`billing_mode = manual`)** |
| **G3** | T20–T25 | Pago con tarjeta de prueba, OXXO de prueba, falla de pago → `past_due` → suspensión → pago → reactivación. Web y precios | Cobro automático listo |
| **G4** | T30–T34 + `LAUNCH-CHECKLIST` completo | Recorrido completo como cliente nuevo en móvil | **Venta abierta.** Cambian las reglas de §5 |

**Si un gate falla, no se avanza de fase.** Se abre un ticket de bug `B<nn>` y se arregla primero.

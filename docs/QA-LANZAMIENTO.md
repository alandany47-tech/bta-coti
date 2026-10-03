# QA de lanzamiento (T34)

> Corrida del 2026-10-03 contra la base real de desarrollo y Stripe en modo prueba. Repetible:
> `npm run e2e:launch` (41 comprobaciones, ~3 min; levanta `next dev` en :3199, un Resend falso en :4555 y
> `stripe listen`, y borra todo lo que crea). Requiere `.env.local` con llaves `sk_test_`, Stripe CLI y un
> Chromium (`CHROMIUM_PATH` o `npx playwright-core install chromium`). Detalle y límites en el encabezado de `scripts/launch-e2e.mjs`.

## Qué recorre (todo en verde)
1. **Web pública** (escritorio y móvil): 10 páginas cargan, sin scroll horizontal ni errores de consola; imagen OG y `/api/health`; el cron exige su secreto.
2. **Demos**: 6 vitrinas operables; `demo-suspendida` → `/suspended`; `demo-cancelada` → 404.
3. **Registro**: subdominio ocupado / correo desechable no pasan el formulario; el enlace de confirmación provisiona un negocio en prueba de 7 días con plan, dueño y plantillas de mensaje, y manda la bienvenida (T25).
4. **Onboarding y catálogo**: WhatsApp y color de marca; 3 servicios dados de alta desde el panel; vitrina móvil con el WhatsApp del negocio; "Mi cotización" no guarda nada.
5. **Cotizar en móvil**: descuento por línea + IVA, total del servidor = total en pantalla, folio 1, WhatsApp al número del cliente con el enlace, página pública con el mismo total, PDF real descargado, vista contada.
6. **Equipo en prueba**: no se puede invitar.
7. **Pago**: Facturación, Checkout con tarjeta (sesión de Stripe), pago (tarjeta 4242 por API) → `active` en el plan, no deja pagar dos veces, portal, y ya pagado el equipo admite invitar por correo.
8. **Prueba vencida → suspensión → pago → reactivación**: suspende con `trial_expired`, vitrina a `/suspended`, Facturación sí abre, el pago reactiva y la vitrina vuelve.

Además: 149 pruebas unitarias, lint, build, y todos los archivos pgTAP contra la base (RLS, cuotas, demos, Stripe, equipo…). `demo.sql` marca 1 falla **esperada** contra esta base: su primera comprobación exige "sin demos previas" y aquí ya existen (el archivo corre dentro de una transacción que se revierte).

## Hallazgos de esta QA (corregidos)
| Hallazgo | Corrección |
|---|---|
| **Crítico:** `next` 16.3.4 con RCE en `next/og` (`ImageResponse`, que usamos para las vistas previas) y `brace-expansion` alto | `next` y `eslint-config-next` → 16.3.8; `npm audit --omit=dev`: **0 vulnerabilidades**. Quedan avisos solo de desarrollo (eslint, vitest) |
| **Alto:** a un cliente capturado con 10 dígitos se le armaba `wa.me/5598765432` sin el 52: WhatsApp leería "55" como Brasil y el mensaje iría a otro número (desde T15) | `lib/whatsapp.ts` normaliza igual que la vitrina (10 dígitos → 52); pruebas nuevas |
| Sin encabezados de seguridad | `next.config.ts`: HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una CSP parcial (`frame-ancestors`, `object-src`, `base-uri`). La CSP completa (scripts/imágenes) queda para afinar con tráfico real |
| Mi trigger de tope de usuarios (T33) rompía los datos de prueba de `foundation.sql` y `message_templates.sql` | Esos fixtures desactivan el trigger (el tope se prueba en `team.sql`) |
| Codex: `.impeccable/config.local.json` no debe versionarse | `.gitignore` |
| Codex: "Hobby permite 2 crons" | Ya no aplica: la documentación de Vercel (2026-07) da 100 crons por proyecto en Hobby, con frecuencia mínima diaria (los 3 de `vercel.json` cumplen). Sin cambio |

## Lo que NO se pudo comprobar aquí (te toca a ti, antes de vender)
**Bloqueantes**
- [ ] **Registrarte una vez con un correo real** y revisar que llega el correo de confirmación. La base exige confirmar (`mailer_autoconfirm: false`), el SMTP por defecto de Supabase tiene un tope muy bajo por hora y se ven mal los remitentes: **configura Supabase Auth → SMTP con Resend** (mismo dominio verificado) y corre `supabase config push` para las plantillas.
- [ ] Verificar `ayxco.app` en Resend y poner `RESEND_API_KEY` (docs/DEPLOY.md §2c-bis); sin eso no salen bienvenida, avisos de prueba, pago fallido ni invitaciones de equipo.
- [ ] Teclear `4242 4242 4242 4242` en el Checkout hospedado de Stripe y volver a `?checkout=success`.
- [ ] Dominio con subdominios comodín (T10) y probar el flujo en vivo en `slug.ayxco.app` (en local el panel de `*.localhost` cae en el bucle de cookies conocido).
- [ ] Rotar las keys de Supabase, Turnstile en registro y Captcha en Supabase Auth (LAUNCH-CHECKLIST §3–4).

**Recomendadas**
- [ ] Abrir un PDF de cada plantilla en iPhone (Safari), Android (Chrome) y escritorio; y revisar la vista previa del enlace `/q/` pegado en WhatsApp.
- [ ] Lighthouse en la web (≥95) y en una vitrina con fotos (≥85), ya desplegado en Vercel (contra `next dev` no vale).
- [ ] Cronometrar en un teléfono real "10 líneas en < 60 s" (T30).
- [ ] Probar una restauración de backup y el tope de gasto de Vercel/R2.
- [ ] Probar fotos reales subiendo a R2 desde el dominio de producción (el CORS bloquea `localhost`).

**Huecos conocidos del producto (no bloquean una prueba piloto)**
- Botón "Reportar contenido" en vitrina y cotización; exportación de datos del negocio y derechos ARCO; transferir la propiedad; CSP completa; `/codex:review` de los PR #39–#45.

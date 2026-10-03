# Checklist de lanzamiento (producción y venta)

> Marcar `[x]` al completar. Nada sale a venta con pendientes en §1–§5.

## 1. Legal y fiscal (Alan)
- [ ] **Validar con contador** cobrar sin IVA y sin CFDI. Aunque no factures, Stripe México pide RFC y reporta ingresos. Si un cliente empresa pide factura y no puedes darla, pierdes la venta.
- [ ] Cuenta de Stripe México verificada: RFC, CLABE, identificación. OXXO y SPEI activados en el dashboard.
- [ ] Términos y condiciones: uso aceptable, contenido del cliente, suspensión por falta de pago, límites de responsabilidad sobre cotizaciones.
- [ ] Aviso de privacidad (LFPDPPP). El tenant es responsable de los datos de **sus** clientes y nosotros somos encargados.
- [ ] Política de reembolsos y cancelación: sin reembolsos prorrateados, se cancela al fin del periodo.
- [ ] Registro de marca en IMPI (después de elegir nombre, no bloqueante).

## 2. Cuentas y accesos
> Los dos pasos que más bloquean (SMTP de Supabase con Resend y dominio comodín) tienen guía: `docs/PASO-A-PASO-SMTP-Y-DOMINIO.md`.
- [ ] Dominio en Cloudflare Registrar, con auto-renovación.
- [ ] Correo del dominio (soporte@, hola@), por ejemplo con Cloudflare Email Routing (gratis) a tu Gmail.
- [ ] Resend con el dominio verificado: SPF, DKIM y DMARC (`p=quarantine`). **También** como SMTP de Supabase Auth (el por defecto tiene un tope muy bajo por hora y la base exige confirmar el correo: sin esto el registro se atora).
- [ ] Vercel Pro, Supabase Pro (prod), Cloudflare (R2, Turnstile), Stripe y GitHub.
- [ ] **2FA en todas las cuentas.** Correo de equipo, no personal, como dueño de las cuentas.
- [ ] Un gestor de contraseñas compartido para las credenciales.

## 3. Entornos y datos
- [ ] Tres entornos: local, staging (previews de Vercel + Supabase staging) y prod. Llaves distintas por entorno.
- [ ] **Rotar las keys actuales de Supabase** antes de prod (han estado en máquinas y sesiones de desarrollo).
- [ ] Backups diarios de Supabase Pro. Evaluar PITR. **Probar una restauración** antes del lanzamiento.
- [ ] Exportación de datos del tenant (CSV de ítems, clientes y cotizaciones) y borrado a los 90 días de cancelar.
- [ ] Topes de gasto según `ABUSE-AND-LIMITS.md` §1.

## 4. Seguridad
- [ ] Tests de RLS en CI (aislamiento entre tenants, anon bloqueado).
- [ ] Rate limit en registro, login, `/api/media/*` y `/q/*`. Turnstile en registro.
- [ ] Turnstile: widget en Cloudflare, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Vercel y Captcha (Turnstile) activado en Supabase Auth con el secret; sin lo segundo, un `signUp` directo con la anon key se salta el formulario.
- [x] Headers: HSTS, nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy (`next.config.ts`, T34). **Falta** una CSP completa (scripts/imágenes: R2, Sentry, Stripe, Turnstile): empezar en Report-Only con tráfico real.
- [ ] Antiphishing automático activo (T18, `ABUSE-AND-LIMITS.md` §3).
- [ ] Botón "Reportar contenido" en storefront y cotización, con suspensión rápida desde el admin.
- [ ] Stripe según el checklist de `STRIPE.md` §8.
- [x] `npm audit --omit=dev` sin vulnerabilidades (T34: `next` 16.3.8 por el RCE de `next/og`). Quedan avisos solo de desarrollo (eslint, vitest).

## 5. Calidad
- [x] E2E con Playwright: registro → onboarding → ítem → cotización → WhatsApp → PDF → pago → suspensión → reactivación (`npm run e2e:launch`, 41/41; informe y pendientes manuales en `docs/QA-LANZAMIENTO.md`).
- [ ] PDF probado en iPhone (Safari), Android (Chrome) y escritorio.
- [ ] Links `/q/` con buena vista previa en WhatsApp (OG image dinámica con logo del tenant).
- [ ] Móvil primero: el broker cotiza desde el teléfono.
- [ ] Lighthouse ≥ 95 en la web y ≥ 85 en el storefront con fotos.

## 6. Operación
- [ ] Monitoreo completo según `MONITORING.md` (T19).
- [ ] Canal de soporte: WhatsApp Business con respuestas rápidas y `/ayuda` con 10 preguntas frecuentes.
- [ ] Guion de onboarding manual para los primeros 10 clientes (videollamada de 15 minutos). Es la mejor fuente de feedback.

## 7. Comercial
- [x] Demo según `DEMO.md` (T26, T27): 8 tenants, cotización de prueba sin guardar datos, Servicios y Catálogo.
- [ ] Pilotos con los clientes actuales desde G2 (cobro manual, precio fundador congelado).
- [ ] Métricas: conversión de prueba a pago, cotizaciones por tenant por semana y churn mensual.
- [ ] Cupones de Stripe para pilotos y referidos.

## 8. Desarrollo en la nube (créditos de Claude, vencen el 5 de octubre)
- [ ] Hacer commit y push de `docs/` a GitHub (`bta-coti`). Las sesiones en la nube leen el repo de GitHub, no tu carpeta local.
- [ ] En claude.ai/code: una sesión por ticket, cada una en su rama y con su PR (ver `PROMPTS.md`).
- [ ] Orden sugerido: T00 → T01 (secuencial) y después T02, T12 y T16 en paralelo.
- [ ] Las variables de entorno de la sesión en la nube apuntan a Supabase **staging**, nunca a prod.

## 9. Puntos que suelen olvidarse
- [ ] **Cambio de subdominio:** se permite 1 vez; el anterior redirige 30 días y después se libera (bloqueado para otros 90 días).
- [ ] **Transferir la propiedad** de un tenant a otro usuario (el broker se va de la inmobiliaria).
- [ ] **Derechos ARCO:** borrar la cuenta y los datos a petición (botón en Configuración + proceso en el admin).
- [ ] **Import de Excel:** plantilla descargable por módulo, con validación y reporte de errores por fila.
- [ ] Formatos MX: moneda `es-MX`, fechas `dd/mm/aaaa`, zona `America/Monterrey` por tenant.
- [ ] **Folio consecutivo** por tenant en las cotizaciones y vigencia configurable.
- [ ] Aviso de cookies solo si se usa analítica con cookies (Vercel Analytics no las usa).
- [ ] Accesibilidad básica: foco visible, labels y contraste AA (auditar con la skill de diseño).

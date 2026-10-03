# Paso a paso: correo (SMTP) y dominio comodín

> Hecho el 2026-10-03 con la documentación vigente de Vercel, Resend y Supabase. Los nombres de los
> botones cambian de vez en cuando: si algo no aparece igual, busca la palabra en negritas.
> Orden recomendado: **A → B → C → D**. Tiempo: ~1 h de trabajo y hasta unas horas de espera de DNS.

## 0. ¿Qué es el dominio comodín?
Cada negocio vive en su propio subdominio: `torrezafiro.ayxco.app`, `muebles-nogal.ayxco.app`… Un
**dominio comodín** (`*.ayxco.app`, "wildcard") es un registro DNS que dice "cualquier nombre antes de
`.ayxco.app` va a nuestra app". Así un cliente nuevo estrena su dirección en el instante en que se registra,
sin que tú crees nada en el DNS. Sin él, solo funcionan `ayxco.app/login`, `/registro` y demás rutas del dominio
raíz: **ninguna vitrina ni panel de cliente** (`slug.ayxco.app/panel`) se puede abrir. Por eso es el último
pendiente técnico antes de vender (T10).

Requiere dos cosas: (1) un registro `*` que apunte a Vercel y (2) un certificado HTTPS comodín. El segundo es lo
delicado: Vercel necesita poder demostrar que el dominio es tuyo por DNS, y como tu dominio está en Cloudflare
(el Registrar de Cloudflare obliga a usar sus servidores DNS), se hace con una **delegación** de un solo nombre
(`_acme-challenge`), sin cambiar tus nameservers (ver parte C).

## 0.1 Antes de empezar: una advertencia sobre `supabase config push`
`supabase config push` empuja **todo** `supabase/config.toml` al proyecto de Supabase enlazado y, sin terminal
interactiva (o con `--yes`), **no pregunta**: aplica. Hoy lo corrí así por error (creí que `echo n` lo cancelaba) y
durante unos minutos el proyecto de desarrollo tuvo `site_url` de localhost, confirmación de correo apagada y MFA
apagado. Ya está corregido: `config.toml` ahora refleja lo que hay en el Dashboard (`site_url = https://ayxco.app`,
redirecciones de `ayxco.app`, confirmación obligatoria, OTP de 8 dígitos, MFA TOTP) y las plantillas de correo en
español ya están aplicadas en desarrollo. Regla desde ahora: **primero `supabase config diff` (solo lee), revisa, y
solo entonces `supabase config push`**. En el proyecto de producción es obligatorio.

---

## A. Resend: verificar `ayxco.app` (correo de la app y base del SMTP)
1. [resend.com](https://resend.com) → **Domains** → **Add Domain** → `ayxco.app`. Región: la más cercana a México
   (São Paulo o Norte de Virginia).
2. Resend te muestra una tabla de registros. En **Cloudflare → ayxco.app → DNS → Records → Add record** crea cada
   uno tal cual (todos en **DNS only**, nube gris):
   | Tipo | Nombre | Valor |
   |---|---|---|
   | `MX` | `send` | el que indique Resend (`feedback-smtp.<región>.amazonses.com`, prioridad 10) |
   | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` (o el que muestre Resend) |
   | `TXT` | `resend._domainkey` | la llave DKIM larga que muestra Resend |
   | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:hola@ayxco.app` |
3. De vuelta en Resend → **Verify DNS Records**. Puede tardar de minutos a unas horas hasta quedar **Verified**.
4. DMARC: empieza en `p=none` una o dos semanas; cuando veas que tus correos legítimos pasan, cámbialo a
   `p=quarantine` (como pide docs/LAUNCH-CHECKLIST.md). Con `quarantine` desde el día 1 puedes mandar a spam tu propio correo.
5. **API Keys → Create API Key**, permiso **Sending access**, dominio `ayxco.app`. Crea **dos**:
   una llamada `app` (va a Vercel como `RESEND_API_KEY`) y otra `supabase-auth` (va al SMTP de Supabase en la parte B).
   Así puedes revocar una sin tumbar la otra. Cópialas en tu gestor de contraseñas: Resend solo las muestra una vez.
6. En Vercel → Project → **Settings → Environment Variables**: `RESEND_API_KEY` = la llave `app` (Production y Preview).
   `EMAIL_FROM` y `EMAIL_REPLY_TO` son opcionales (por defecto `AYXCO <hola@ayxco.app>`). Redespliega.
7. Para que `hola@` y `soporte@` reciban respuestas: **Cloudflare → Email → Email Routing** (gratis) hacia tu correo.
   No choca con Resend: el MX de Resend está en `send.ayxco.app`, el de Email Routing en el apex.

## B. SMTP de Supabase Auth con Resend (correo de confirmación, recuperar contraseña, enlace mágico)
Por qué: el registro exige confirmar el correo (la base tiene confirmación obligatoria) y el SMTP integrado de
Supabase manda muy pocos correos por hora y desde un remitente genérico. Sin esto, el registro se atora.
1. Supabase Dashboard → proyecto **(producción)** → **Authentication → Emails → SMTP Settings** (según la versión
   puede estar en *Notifications → Email*). Activa **Enable custom SMTP**.
2. Llena:
   - **Sender email:** `hola@ayxco.app` · **Sender name:** `AYXCO`
   - **Host:** `smtp.resend.com` · **Port:** `465`
   - **Username:** `resend` · **Password:** la llave `supabase-auth` de Resend
3. **Save**. Luego, en **Authentication → Rate Limits**, sube *emails sent* de la cifra por defecto a algo como
   100 por hora (la protección contra abuso real la dan Turnstile y el límite por IP).
4. Plantillas en español (producción): `supabase link --project-ref <ref-prod>`, luego
   ```bash
   supabase config diff
   ```
   Debe mostrar solo diferencias esperadas (plantillas, y en `[auth.email.smtp]` si lo declaras). Si todo cuadra:
   ```bash
   supabase config push
   ```
   (El bloque `[auth.email.smtp]` de `config.toml` está comentado; no hace falta declararlo: la contraseña se puso en el Dashboard.)
5. Prueba real: abre `https://ayxco.app/registro`, regístrate con **tu correo real** (uno que no hayas usado), y
   revisa que (a) llega "Confirma tu correo" de AYXCO en menos de un minuto, (b) no cae en spam, (c) el botón te lleva a
   `tu-slug.ayxco.app/panel/bienvenida`, (d) llega después el correo de **bienvenida** (ese sale por la llave `app`).

## C. Dominio comodín `*.ayxco.app` en Vercel (con el DNS en Cloudflare)
> Hobby de Vercel es para uso no comercial: este es el momento de pasar el proyecto a **Pro** (un clic, sin
> redesplegar). Si Vercel no te deja agregar el comodín, es por el plan.

1. Vercel → Project → **Settings → Domains → Add Domain**: agrega **`ayxco.app`** y luego **`*.ayxco.app`**.
   Vercel te dirá que el comodín necesita validar el certificado por DNS y que tienes la opción de nameservers
   *o* la delegación: elige la delegación (no cambies los nameservers: ahí viven tu correo, R2 y Resend).
2. En Vercel (a nivel equipo) → **Domains** → `ayxco.app` → **DNS Records** → **Enable Vercel DNS**
   (déjalo con tus nameservers de Cloudflare; esto solo le da a Vercel una zona para contestar el desafío).
3. En **Cloudflare → DNS → Records** crea, todos en **DNS only** (nube gris, NO proxied):
   | Tipo | Nombre | Valor |
   |---|---|---|
   | `NS` | `_acme-challenge` | `ns1.vercel-dns.com` |
   | `NS` | `_acme-challenge` | `ns2.vercel-dns.com` |
   | `CNAME` | `*` | `cname.vercel-dns-0.com` |
   | `A` | `@` (apex) | `76.76.21.21` (si Vercel te muestra otro valor, usa el suyo) |
   | `CNAME` | `www` | `cname.vercel-dns-0.com` |
   Deja como están `media` (R2, proxied) y los registros de `send`, `resend._domainkey`, `_dmarc` y de Email Routing:
   un nombre con registro propio no lo toca el comodín. **Mantén** los dos `NS` de `_acme-challenge` siempre: así Vercel renueva el certificado solo.
4. Espera. En Vercel → Settings → Domains, `ayxco.app` y `*.ayxco.app` deben quedar con **Valid Configuration**
   y certificado emitido (de minutos a unas horas). Revisa desde tu terminal:
   ```bash
   dig +short torrezafiro.ayxco.app      # debe responder (cualquier nombre)
   dig +short NS _acme-challenge.ayxco.app   # ns1/ns2.vercel-dns.com
   ```
5. Variable **`NEXT_PUBLIC_ROOT_DOMAIN=ayxco.app`** en Production (docs/DEPLOY.md §2) y **Redeploy**. Es la que hace que
   `proxy.ts` y las cookies traten `*.ayxco.app` como negocios y `ayxco.app` como raíz.
6. Subdominios que no se regalan a un negocio: la migración `0036` reserva `send`, `resend`, `ns1`, `ns2`, `smtp`, `mx`,
   `email`, `correo`, `webmail`, `preview`, `staging`, `dev` (además de `www`, `app`, `api`, `admin`, `media`, `mail`, `cdn`…
   de antes). Aplícala en producción con `supabase db push`.
7. Previews de Vercel (opcional, después): los previews `*.vercel.app` no admiten subdominios por negocio. Si quieres probar
   ramas con negocios reales, repite esto para `*.preview.ayxco.app` y pon `NEXT_PUBLIC_ROOT_DOMAIN=preview.ayxco.app` en *Preview*.

## D. Prueba final del dominio (en vivo)
1. `https://ayxco.app` carga la web y `https://www.ayxco.app` redirige.
2. `https://demo-broker.ayxco.app` muestra la vitrina de la demo (y `https://demo-suspendida.ayxco.app` te manda a `/suspended`).
3. Inicia sesión en `https://ayxco.app/login` con tu cuenta de dueño: debe llevarte a `https://<tu-slug>.ayxco.app/panel`
   **sin bucle de redirecciones** (la cookie de sesión va en el dominio raíz y la leen todos los subdominios;
   el bucle que ves en `*.localhost` no existe aquí). Entra a Catálogo, Cotizar, Plantillas y Equipo.
4. Sube una foto a un producto: confirma que R2 acepta el origen `https://*.ayxco.app` (CORS del bucket, docs/DEPLOY.md §2b).
5. Crea una cotización, ábrela en `https://<slug>.ayxco.app/q/<token>`, descarga el PDF y pega el enlace en un chat de WhatsApp.
6. Stripe → Webhooks: el endpoint en vivo debe ser `https://ayxco.app/api/stripe/webhook`.
7. Cuando todo funcione, repite el recorrido automatizado contra producción con tarjeta de prueba y marca en
   docs/LAUNCH-CHECKLIST.md y docs/QA-LANZAMIENTO.md lo que quedó comprobado.

## Problemas comunes
| Síntoma | Causa y arreglo |
|---|---|
| Vercel dice "Invalid Configuration" para `*.ayxco.app` | Faltan o están mal los dos `NS` de `_acme-challenge`, o el `CNAME *` está en nube naranja. Corrige y espera. |
| `torrezafiro.ayxco.app` da error de certificado | El certificado comodín aún no se emite: confirma los `NS` y que "Enable Vercel DNS" siga activo. |
| Un negocio abre pero el panel te manda al login una y otra vez | `NEXT_PUBLIC_ROOT_DOMAIN` mal puesto o sin redesplegar tras cambiarlo. |
| Dejó de llegar correo de `hola@` | Tocaste los nameservers o borraste los MX del apex: restáuralos (Cloudflare → Email Routing → reparar). |
| El correo de confirmación tarda o cae en spam | Resend aún no muestra **Verified**, o DMARC está en `quarantine` demasiado pronto. Revisa Resend → Logs. |
| "Email rate limit exceeded" en el registro | Falta el SMTP propio (parte B) o el límite de *emails sent* sigue bajo. |
| Un cliente nuevo no puede registrar el nombre que quería | Está en la lista reservada/bloqueada (T18, 0036): se le sugiere otro; el admin puede liberar uno con `blocked_terms_allow`. |

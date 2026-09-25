# Topes de gasto, límites de uso y antiabuso

## 1. Topes de gasto por proveedor (configurar el día 1 de producción)

| Proveedor | Incluido | Configuración | Revisar cuando |
|---|---|---|---|
| **Vercel Pro** | $20 USD de uso incluido | Spend Management: presupuesto de **$50 USD al mes**, avisos al 50/75/100% por correo. **Pausa automática de producción: no.** Tirar el sitio a todos los clientes es peor que pagar $10 extra; se activa solo un tope duro de emergencia en $150 | Más de 50 clientes |
| **Supabase Pro** | 8 GB de DB, 250 GB de egress, 100k MAU | **Spend cap activado** (viene por defecto): nunca cobra excedentes. Al acercarse al límite avisa y se decide | DB > 5 GB o más de 80 clientes |
| **Cloudflare R2** | 10 GB y operaciones gratis al mes | Sin tope duro disponible. Notificación de facturación en **$5 USD**. El control real son las cuotas por plan (§2) | > 100 GB |
| **Resend** | Gratis: 3,000 correos al mes, 100 al día | Subir a Pro ($20) cuando haya más de 40 registros al día | Aviso en el dashboard |
| **Sentry** | 5k errores al mes gratis | Rate limit por proyecto: 100 errores por hora | — |
| **Stripe** | Sin costo fijo | Solo comisión por cobro | — |

**Costo fijo esperado:** Vercel $20 + Supabase $25 + dominio ~$1 = **~$46 USD al mes**. Una alerta de gasto se atiende en menos de 24 horas.

## 2. Límites de uso en la app (protegen costo y abuso)

Viven en `plans.limits` y los aplican triggers o el servidor, nunca solo la UI.

| Límite | Esencial | Catálogo | Broker | Broker Pro | Prueba |
|---|---|---|---|---|---|
| Ítems | 50 | 300 | 25 propiedades + 50 ítems | 100 propiedades + 300 ítems | Igual al plan elegido |
| Almacenamiento | 500 MB | 2 GB | 5 GB | 15 GB | **200 MB** |
| Imágenes por ítem | 3 | 8 | 20 (fotos + renders) + 3 planos | 30 + 5 planos | 5 |
| Cotizaciones al día | 50 | 100 | 100 | 300 | **20** |
| Usuarios | 1 | 2 | 2 | 5 | 1 |
| Peso de archivo | 10 MB antes de comprimir; plano PDF 10 MB | ← | ← | ← | ← |

**Rate limits por IP** (Vercel Firewall; si no alcanza, `@upstash/ratelimit`):

| Ruta | Límite |
|---|---|
| `/registro` y `slug_available` | 5 por minuto y 20 por día |
| `/login` | 10 por minuto |
| `/api/media/sign` | 60 por minuto por tenant |
| `/q/*` | 120 por minuto |
| `/api/*` en general | 300 por minuto |

## 3. Antiphishing: bloqueo automático al registrarse

Se aplica en **tres puntos**:

- la validación en vivo del formulario (`slug_available`);
- el servidor del registro;
- `provision_tenant` en la DB, para que no se pueda saltar desde el cliente.

Mismo resultado en los tres. El usuario solo ve: *"Ese subdominio no está disponible. Prueba con otro."* Nunca se le dice por qué.

### 3.1 Normalización (función `normalize_slug`)

1. Minúsculas, sin acentos y sin guiones.
2. Leetspeak a letras: `0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s`. Además se prueba `1→l` como variante.
3. Letras repetidas colapsadas (`bbvaaa` → `bva` para el chequeo difuso; se conserva `bbva` para el exacto).

### 3.2 Reglas (tabla `blocked_terms`, editable desde el admin)

| Tipo | Regla | Ejemplos |
|---|---|---|
| `reserved` | Coincidencia exacta | www, app, admin, api, media, panel, login, registro, soporte, mail, status, demo… |
| `brand` | **Contiene** el término (términos ≥ 4 letras) o coincidencia exacta (términos cortos) | Bancos: bbva, banorte, santander, banamex, citibanamex, hsbc, scotiabank, inbursa, azteca, banregio, afirme, bancoppel, banbajio, nubank, spin, mercadopago, paypal, stripe, clip, openpay. Gobierno: sat, imss, infonavit, fovissste, cfe, condusef, gob, gobierno, curp, renapo. Tech: apple, icloud, google, gmail, microsoft, outlook, office365, amazon, netflix, facebook, instagram, whatsapp, meta, tiktok, spotify. Retail: oxxo, coppel, liverpool, walmart, elektra, mercadolibre, dhl, fedex, estafeta |
| `fuzzy` | Levenshtein ≤ 1 contra `brand` para términos de 5 letras o más | `santandr`, `banortte`, `paypa1` |
| `keyword` | Contiene | login, signin, verify, verificar, secure, seguro, cuenta, account, password, contrasena, recovery, recuperar, wallet, factura-sat, token, auth, sso, soporte-tecnico, desbloqueo |

- También se revisan **el nombre del negocio** y el **dominio del email**. Un nombre con marca bloqueada se registra, pero queda como `flagged` para revisión en el admin, y el slug sí se bloquea.
- **Emails desechables** bloqueados (lista `disposable-email-domains`, actualizada por cron semanal).
- **Una prueba por email** y, en F2, una por teléfono verificado.
- **Falsos positivos:** "¿Tu negocio se llama así? Escríbenos". El admin puede crear una excepción (`blocked_terms_allow`) para ese slug.

### 3.3 Contención después del registro

- Los storefronts en prueba llevan `noindex` y un pie visible "Sitio creado con {marca}": le quita valor como phishing.
- **Los formularios que piden contraseñas o tarjetas quedan prohibidos en el storefront.** El tenant no puede inyectar HTML ni scripts (solo texto, imágenes y links). CSP estricta en `slug.*`.
- Botón "Reportar este sitio" en el storefront y en `/q/*` → `abuse_reports` → alerta al admin. Con 3 reportes en 24 horas se suspende automáticamente (`status_reason = 'abuse_review'`).
- Links externos del tenant: solo `https`, sin acortadores.

## 4. Tablas nuevas

```sql
blocked_terms (term text pk, kind text check (kind in ('reserved','brand','keyword')), created_at)
blocked_terms_allow (slug text pk, tenant_id uuid, reason text, created_by uuid, created_at)
abuse_reports (id, tenant_id, url, reason, reporter_ip_hash, created_at, resolved_at, resolution)
stripe_events (id text pk, type text, processed_at timestamptz)
```

Funciones: `normalize_slug(text)`, `is_slug_blocked(text) returns boolean` (usa `fuzzystrmatch.levenshtein`). Las llama `slug_available` y `provision_tenant`.

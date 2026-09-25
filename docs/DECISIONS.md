# Registro de decisiones

| # | Fecha | Decisión | Por qué |
|---|---|---|---|
| D01 | 2026-09-25 | Una sola plataforma con 3 módulos (Servicios, Catálogo, Broker) activados por plan | Un código, upgrades sin migrar al cliente |
| D02 | 2026-09-25 | Solo subdominio (`slug.dominio.com`), sin dominio propio del cliente | Simplicidad; se puede agregar después |
| D03 | 2026-09-25 | **App en Vercel Pro**; medios en **Cloudflare R2**; datos y auth en **Supabase** | Vercel corre Next 16 sin adaptadores y le sirve a Alan para otros proyectos; R2 no cobra salida de datos |
| D04 | 2026-09-25 | Hostinger no se usa para la app (solo correo, si aplica) | Hosting compartido: no soporta bien SSR ni subdominios comodín |
| D05 | 2026-09-25 | Prueba gratis de **7 días**, sin tarjeta | Un broker necesita tiempo para cargar propiedades; 3 días no alcanza para ver valor |
| D06 | 2026-09-25 | Dos vías de alta: autoregistro (prueba) y alta manual por admin; las dos usan la misma función `provision_tenant` | Un solo camino de datos, sin duplicar lógica |
| D07 | 2026-09-25 | Pagos: Stripe con tarjeta (recurrente), OXXO y SPEI (factura por periodo) en MXN | Mercado mexicano |
| D08 | 2026-09-25 | PDF generado en el navegador; la cotización se comparte como página web `/q/<token>` | 0 almacenamiento de PDFs y 0 CPU del servidor |
| D09 | 2026-09-25 | Mensaje de WhatsApp personalizable por el tenant con variables | Pedido de Alan; se mantiene simple (una plantilla por módulo) |
| D10 | 2026-09-25 | Imágenes a WebP en el navegador y cuota verificada en el servidor con el tamaño real en R2 | Controlar almacenamiento y abuso |
| D11 | 2026-09-25 | **Un solo dominio, comprado y con DNS en Cloudflare.** Comodín hacia Vercel delegando `_acme-challenge` (NS a Vercel) + `CNAME *` a Vercel (sin proxy). Medios en `media.dominio.com` (R2, mismo dominio) | La guía de Vercel permite el comodín sin sus nameservers. Así no hace falta un segundo dominio y el registro sale a precio de costo |
| D12 | 2026-09-25 | Marca de producto claro-primero ("papel y tinta"), panel incluido | Coherencia con cotizaciones imprimibles; el modo oscuro queda para después |
| D13 | 2026-09-25 | Precios sin IVA desglosado y sin facturación CFDI por ahora | Decisión de Alan. **Validar con contador** antes de cobrar (ver LAUNCH-CHECKLIST §1) |
| D14 | 2026-09-25 | Usar los $100 de crédito de Claude en sesiones en la nube (vence el 5 de octubre) para F0/F1 en paralelo | Aprovechar el crédito sin tocar los límites del plan |
| D15 | 2026-09-25 | Claude Code (Opus) construye y orquesta. Codex, vía `openai/codex-plugin-cc`, revisa todo PR y toma tickets delegados | Un solo responsable del código y una segunda opinión de otro modelo |
| D16 | 2026-09-25 | Construcción directa en producción (un proyecto de Supabase, `main` = prod, Stripe en test) hasta el Gate 4; ahí se crea staging | No hay clientes; se reduce la fricción |
| D17 | 2026-09-25 | Pilotos con clientes actuales desde G2, con cobro manual; la demo va antes que Stripe | Los clientes ya existen y esperan |
| D18 | 2026-09-25 | Antiphishing automático en DB (normalización + marcas + difuso + keywords), sin revisión manual previa | Bloqueo inmediato; los falsos positivos se resuelven con allowlist desde el admin |
| D19 | 2026-09-25 | T18: `term` es pk único, así que `login` y `stripe` viven como `keyword`/`brand` (coincidencia por "contiene", que ya cubre la exacta). El difuso es Levenshtein ≤ 1 contra el slug completo (términos de 5+ letras) y contra ventanas solo para términos de 7+ letras: con ventanas en términos cortos `email` caía como `gmail`. Nombre o dominio de correo con marca solo marcan `flagged`; correo desechable se bloquea solo en `self_signup` | Evitar falsos positivos sin abrir huecos; el admin resuelve el resto con `blocked_terms_allow` |
| D20 | 2026-09-25 | Rate limits con `@upstash/ratelimit` (falla abierto sin Redis o si Redis cae) y reglas de Vercel Firewall en prod; la lista de correos desechables se sincroniza desde `disposable-email-domains` con script y ruta de cron protegida por `CRON_SECRET` | Vercel aún no está configurado; el limitador en código se puede probar y reutilizar en registro y login |

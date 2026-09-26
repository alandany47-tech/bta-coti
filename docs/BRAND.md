# Brand: identidad y sistema de diseño

> Fuente de verdad visual para la web, el panel, el admin, las cotizaciones y el PDF. Los tokens de Figma y `app/globals.css` deben coincidir 1:1 con §4 a §7.

## 1. Nombre

Nombre: **AYX Cotiza** (decidido por el dueño del producto, sustituye al provisional "BTA Cotiza"). "AYX" va primero y es la marca; "Cotiza" describe el producto. Falta validar dominio .com / .mx y marca en IMPI. Alternativas que se evaluaron, por si el dominio no se consigue:

| Nombre | Idea |
|---|---|
| **Folio** | El documento formal: numerado, serio |
| **Pliego** | Papel, propuesta formal, editorial |
| **Cuota** | Directo al precio |
| **Presta** | Rápido, ágil |
| **Tarifa** | Claro y comercial |

En código, el nombre vive **solo** en `lib/brand.ts` (`BRAND.name`, `BRAND.domain`). Nunca va hardcodeado.

## 2. Personalidad

- **Somos:** preciso, confiable, sobrio, cálido y rápido.
- **No somos:** futurista, "mágico", juguetón, corporativo frío ni startup genérica.
- **Metáfora:** *papel y tinta*. Una cotización bien hecha en buen papel, llevada a la pantalla.
- **Promesa:** "Cotizaciones que cierran ventas, listas en un minuto."

## 3. Voz y tono

- Español de México, de **tú**. Frases cortas, verbos al inicio: "Crea tu cotización", no "¡Comienza a crear cotizaciones increíbles!".
- Números concretos: "Listo en 60 segundos", no "súper rápido".
- **Sin** signos de exclamación en la UI, sin emojis y sin "potencia", "revoluciona", "impulsa" ni "IA".
- **Errores:** qué pasó + qué hacer. "No pudimos subir la imagen. Debe pesar menos de 10 MB."
- **Estados vacíos:** una línea de contexto + una acción. "Aún no tienes clientes. Agrega el primero."

## 4. Color (claro primero; el modo oscuro queda para después)

| Token | Hex | Uso |
|---|---|---|
| `--paper` | `#F7F6F3` | Fondo de la app y la web |
| `--surface` | `#FFFFFF` | Tarjetas, tablas, modales |
| `--sunken` | `#EFEDE8` | Inputs, zonas hundidas, hover de filas |
| `--line` | `#E3E0D9` | Bordes de 1px |
| `--line-strong` | `#CFCBC2` | Bordes de foco y separadores fuertes |
| `--ink` | `#1A1917` | Texto principal y botón primario |
| `--ink-2` | `#4A4843` | Texto secundario |
| `--ink-3` | `#8A867D` | Placeholders, metadatos |
| `--accent` | `#B4532A` | Terracota: acento de marca, links, selección (usar poco) |
| `--accent-soft` | `#F4E6DE` | Fondo de acento |
| `--ok` | `#2E6B4F` | Éxito, "disponible" |
| `--warn` | `#A86A12` | Aviso, "reservado", prueba por vencer |
| `--danger` | `#B42318` | Error, "vendido", borrar |

- **Regla 90/8/2:** 90% neutros, 8% tinta, 2% acento. El botón primario es **tinta**, no terracota.
- Contraste mínimo AA en todo el texto. Verificar `--ink-3` sobre `--paper` solo en texto ≥ 14 px.
- **Tema del tenant** (storefront, catálogo, cotización): el tenant elige `accent` y logo. El sistema calcula texto sobre acento (negro o blanco según contraste) y rechaza acentos con contraste < 3:1 contra `--surface`.

## 5. Tipografía (validar en Figma)

| Rol | Fuente | Notas |
|---|---|---|
| Display / titulares web y cotización | **Newsreader** (Google Fonts), 500–600 | Serif editorial: da el aire de "documento formal" |
| UI y texto | **Instrument Sans** (Google Fonts), 400/500/600 | Sans con carácter, legible en tablas |
| Cifras | Instrument Sans con `font-variant-numeric: tabular-nums` | Montos alineados en columnas |

- Se sale de **Geist**: es la tipografía por defecto de Vercel/Next y delata la plantilla.
- **Escala** (px): 12 · 13 · 14 (base UI) · 16 (base web) · 20 · 24 · 32 · 44 · 60. Interlineado: 1.5 en texto, 1.15 en titulares. Tracking de −0.01em en titulares ≥ 32.
- El serif **solo** en titulares y en montos grandes de la cotización. Nunca en botones ni tablas.

## 6. Espacio, forma y profundidad

- **Grid de 4 px.** Espaciados: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- **Radios:** 6 (inputs, botones), 10 (tarjetas), 14 (modales). Nada de pills salvo badges.
- **Bordes** de 1px `--line` en lugar de sombras. Sombra solo en capas flotantes: `0 1px 2px rgb(26 25 23 / .06), 0 8px 24px rgb(26 25 23 / .08)`.
- **Anchos:** web con contenido de máximo 1120 px. El panel usa todo el ancho con sidebar de 232 px.
- **Densidad:** filas de tabla de 44 px, inputs de 36 px (40 en móvil), botones de 36 px.

## 7. Motion (principios de Emil Kowalski)

- **Duraciones:** 120 ms (hover, press), 180 ms (popover, dropdown), 240 ms (modal, drawer). Nunca más de 300 ms en UI.
- **Easing de entrada y salida:** `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out fuerte). Para movimiento en pantalla: `cubic-bezier(0.77, 0, 0.175, 1)`.
- **Press:** los botones hacen `scale(0.97)`. Los popovers entran desde `scale(0.96)` + opacidad, con origen en el trigger, nunca desde `scale(0)`.
- **Sin animación** en acciones repetidas por teclado, cambios de filtro ni la navegación del panel.
- `prefers-reduced-motion`: solo se quedan los cambios de opacidad.
- **Librerías:** CSS primero; `motion` solo para layout y gestos. Toasts con **Sonner** y drawers móviles con **Vaul**.

## 8. Componentes base

- **Base:** shadcn/ui (Radix) re-tematizado con los tokens de arriba. Iconos **Lucide** de 16/20 px, stroke de 1.5.
- **Botones:** primario (tinta sobre papel), secundario (borde), fantasma, peligro. Un solo primario por vista.
- **Tablas:** encabezado 12 px en mayúsculas pequeñas `--ink-3` y números alineados a la derecha.
- **Badges de estado:** punto de color + texto, no fondos saturados.
- **Cotización (web y PDF):** membrete con logo del tenant, folio y fecha arriba a la derecha, monto total en Newsreader grande, desglose en tabla limpia y pie con vigencia y datos de contacto.

## 9. Anti-"hecho con IA": checklist obligatorio antes de entregar UI

**Prohibido:**

- Gradientes morado-azul, glassmorphism y glow.
- Emojis en la UI, íconos dentro de círculos de color en cada tarjeta.
- Hero con "✨", frases genéricas o cuadrículas de 3 tarjetas idénticas.
- Sombras exageradas o bordes redondeados de 24 px o más.
- Ilustraciones 3D de stock.

**Obligatorio:**

- Mostrar el producto real (capturas de la cotización o del panel) en lugar de ilustraciones.
- Jerarquía por tamaño y peso, no por color.
- Alineación a la grilla y textos con datos concretos.

**Skills** (instalar en el repo para Claude Code y Codex; verificar el comando en cada repo):

```bash
npx skills add pbakaus/impeccable       # https://github.com/pbakaus/impeccable
npx skills add emilkowalski/skill       # https://emilkowal.ski/skill
```

- *Impeccable* se usa para auditar y pulir cada pantalla (correr su comando de auditoría antes del PR).
- La skill de Emil se usa para motion e interacción.
- Si alguna regla de las skills contradice este documento, **manda BRAND.md**.

## 10. Logo (pendiente)

- Wordmark en Instrument Sans 600 o Newsreader 600 según el nombre final, más un símbolo simple (una hoja o folio doblado) que funcione a 16 px.
- Monocromo tinta. En terracota solo en favicon y OG image.
- **Entregables:** SVG horizontal, símbolo, favicon (ico + svg + apple-touch) y OG de 1200×630.

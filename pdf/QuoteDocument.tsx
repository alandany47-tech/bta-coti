import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { QuoteViewModel } from "@/lib/quote-view-model";
import { accentTextColor, readableOn, type QuoteTemplate } from "@/lib/quote-templates";

/**
 * Dossier en PDF (T15 → T31). Todo el contenido sale de `QuoteViewModel` (el mismo que pinta la página
 * web) y todo el aspecto de la plantilla (`lib/quote-templates.ts`); aquí no hay montos ni colores
 * propios. Dos hojas: ficha financiera y, si hay propiedad, plano + galería. Las imágenes llegan ya
 * como JPEG (`lib/pdf-client.ts`: react-pdf no lee WebP).
 */
/** Las fuentes estándar del PDF (WinAnsi) no tienen el signo menos tipográfico (U+2212): se cambia por guion. */
const pdfText = (text: string) => text.replace(/\u2212/g, "-");

const STATUS_COLOR = { ok: "#22C55E", warn: "#F59E0B", danger: "#EF4444" } as const;

function makeStyles(t: QuoteTemplate, brand: string) {
  const regular = t.font === "serif" ? "Times-Roman" : "Helvetica";
  const bold = t.font === "serif" ? "Times-Bold" : "Helvetica-Bold";
  const c = t.colors;
  const s2 = t.sheet2;
  const r = t.radius;
  const onBrand = readableOn(brand);
  const statsBordered = t.stats !== "dark";

  return StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: regular, color: c.ink, backgroundColor: c.page },
    // --- encabezado
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
    headerBand: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22,
      padding: 16, borderRadius: r, backgroundColor: brand,
    },
    headerCentered: { alignItems: "center", marginBottom: 22 },
    centeredRule: {
      marginTop: 14, paddingVertical: 8, width: "100%", flexDirection: "row", justifyContent: "center", gap: 14,
      borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.ink,
    },
    tenantBlock: { flexDirection: "row", alignItems: "center", gap: 10 },
    logo: { width: 34, height: 34, objectFit: "contain" },
    logoCentered: { width: 44, height: 44, objectFit: "contain", marginBottom: 8 },
    tenantName: { fontSize: 15, fontFamily: bold, letterSpacing: 0.2 },
    tenantNameCentered: { fontSize: 22, fontFamily: bold, letterSpacing: 0.4, textAlign: "center" },
    tag: { fontSize: 8, color: c.muted, textTransform: "uppercase", letterSpacing: 1 },
    metaBlock: { alignItems: "flex-end" },
    metaTitle: { fontSize: 9, color: c.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
    metaFolio: { fontSize: 12, fontFamily: bold, marginBottom: 2 },
    metaLine: { fontSize: 9, color: c.muted },
    metaCentered: { fontSize: 9, color: c.ink, textTransform: "uppercase", letterSpacing: 1 },
    brandRule: { height: 2, marginBottom: 22, backgroundColor: brand },
    // --- héroe
    hero: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
    heroTitle: { fontSize: t.font === "serif" ? 22 : 18, fontFamily: bold, marginBottom: 3 },
    heroSub: { fontSize: 10, color: c.muted },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: r === 0 ? 0 : 10, backgroundColor: c.soft },
    badgeDot: { width: 5, height: 5, borderRadius: 2.5 },
    badgeText: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.6, color: c.muted },
    sectionLabel: { fontSize: 9, color: c.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 },
    // --- características
    stats: {
      flexDirection: "row", marginBottom: 26, overflow: "hidden", backgroundColor: c.statsBg, borderRadius: t.stats === "inline" ? 0 : r,
      ...(statsBordered ? { borderColor: t.stats === "inline" ? c.ink : c.line, ...(t.stats === "inline" ? { borderTopWidth: 1, borderBottomWidth: 1 } : { borderWidth: 1 }) } : {}),
    },
    statCell: {
      flex: 1, paddingVertical: 14, paddingHorizontal: 10, borderRightWidth: 1,
      borderRightColor: t.stats === "dark" ? "#27272A" : c.line,
    },
    statCellLast: { borderRightWidth: 0 },
    statLabel: { fontSize: 7, color: c.statsMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
    statValue: { fontSize: 12, fontFamily: bold, color: c.statsInk },
    // --- condiciones
    conditions: { marginBottom: 22 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line },
    rowLabel: { fontSize: 10, color: c.ink },
    rowSub: { fontSize: 8, color: c.muted },
    rowValue: { fontSize: 10, fontFamily: bold },
    rowValueMuted: { fontSize: 10, color: c.muted },
    linesHead: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.ink },
    linesRow: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.line },
    colTitle: { flex: 5, paddingRight: 8 },
    colQty: { flex: 2, textAlign: "right" },
    colPrice: { flex: 2.4, textAlign: "right" },
    colDisc: { flex: 1.6, textAlign: "right" },
    colTotal: { flex: 2.4, textAlign: "right" },
    linesHeadText: { fontSize: 7, color: c.muted, textTransform: "uppercase", letterSpacing: 0.8 },
    linesText: { fontSize: 9.5 },
    linesMuted: { color: c.muted },
    linesBold: { fontFamily: bold },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 14 },
    totalBlock: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, padding: 14,
      borderRadius: r, backgroundColor: brand,
    },
    totalLabel: { fontSize: 11, fontFamily: bold },
    totalValue: { fontSize: 16, fontFamily: bold },
    notes: { marginTop: 18, marginBottom: 18, padding: 12, borderRadius: r, backgroundColor: c.soft },
    notesText: { fontSize: 9, color: c.ink, lineHeight: 1.5 },
    footer: { position: "absolute", bottom: 32, left: 40, right: 40, fontSize: 7, color: c.muted, textAlign: "center", lineHeight: 1.5 },
    // --- hoja 2
    page2: { padding: 40, fontFamily: regular, backgroundColor: s2.page, color: s2.ink },
    page2Header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: s2.line,
    },
    page2Title: { fontSize: 13, fontFamily: bold },
    page2Sub: { fontSize: 8, color: s2.muted, marginTop: 2 },
    page2Folio: { fontSize: 8, color: s2.muted },
    galleryLabel: { fontSize: 9, color: s2.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1.2 },
    planBox: {
      height: 220, borderRadius: t.radius === 0 ? 0 : 8, backgroundColor: s2.cell, borderWidth: 1, borderColor: s2.line,
      marginBottom: 24, alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    planImage: { width: "100%", height: "100%", objectFit: "contain" },
    emptyText: { fontSize: 9, color: s2.muted },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    cell: { width: "31.4%", height: 110, borderRadius: r, backgroundColor: s2.cell, borderWidth: 1, borderColor: s2.line, overflow: "hidden" },
    cellPhoto: { width: "100%", height: "100%", objectFit: "cover" },
    page2Footer: { position: "absolute", bottom: 28, left: 40, right: 40, fontSize: 7, color: s2.muted, textAlign: "center" },
    onBrand: { color: onBrand },
    brandAccent: { color: accentTextColor(brand, c.ink) },
  });
}

export type QuoteDocumentProps = {
  model: QuoteViewModel;
  template: QuoteTemplate;
  brandColor: string;
  /** Imágenes ya en JPEG (data URL) o URL directa. */
  logo: string | null;
  images: string[];
  floorPlan: string | null;
};

export function QuoteDocument({ model, template, brandColor, logo, images, floorPlan }: QuoteDocumentProps) {
  const styles = makeStyles(template, brandColor);
  const { header } = template;

  const tenantBlock = (
    <View style={styles.tenantBlock}>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={logo} style={styles.logo} />
      ) : null}
      <View>
        <Text style={[styles.tenantName, header === "band" ? styles.onBrand : {}]}>{model.tenantName}</Text>
        <Text style={[styles.tag, header === "band" ? { color: styles.onBrand.color, opacity: 0.8 } : {}]}>{model.tagline}</Text>
      </View>
    </View>
  );
  const meta = (
    <View style={styles.metaBlock}>
      <Text style={[styles.metaTitle, header === "band" ? { color: styles.onBrand.color, opacity: 0.8 } : {}]}>{model.metaTitle}</Text>
      <Text style={[styles.metaFolio, header === "band" ? styles.onBrand : {}]}>Folio {model.folio}</Text>
      <Text style={[styles.metaLine, header === "band" ? { color: styles.onBrand.color, opacity: 0.8 } : {}]}>{model.date}</Text>
      {model.advisorName ? <Text style={[styles.metaLine, header === "band" ? { color: styles.onBrand.color, opacity: 0.8 } : {}]}>Asesor: {model.advisorName}</Text> : null}
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {header === "centered" ? (
          <View style={styles.headerCentered}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logo} style={styles.logoCentered} />
            ) : null}
            <Text style={styles.tenantNameCentered}>{model.tenantName}</Text>
            <Text style={styles.tag}>{model.tagline}</Text>
            <View style={styles.centeredRule}>
              <Text style={styles.metaCentered}>Folio {model.folio}</Text>
              <Text style={styles.metaCentered}>{model.date}</Text>
              {model.advisorName ? <Text style={styles.metaCentered}>Asesor: {model.advisorName}</Text> : null}
            </View>
          </View>
        ) : (
          <>
            <View style={header === "band" ? styles.headerBand : styles.header}>
              {tenantBlock}
              {meta}
            </View>
            {header === "rule" ? <View style={styles.brandRule} /> : null}
          </>
        )}

        <View style={styles.hero}>
          <View>
            <Text style={styles.heroTitle}>{model.hero.title}</Text>
            <Text style={styles.heroSub}>{model.hero.subtitle}</Text>
          </View>
          {model.hero.status ? (
            <View style={styles.badge}>
              <View style={[styles.badgeDot, { backgroundColor: STATUS_COLOR[model.hero.status.tone] }]} />
              <Text style={styles.badgeText}>{model.hero.status.label}</Text>
            </View>
          ) : null}
        </View>

        {model.stats.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Características generales</Text>
            <View style={styles.stats}>
              {model.stats.map((stat, index) => (
                <View key={stat.label} style={[styles.statCell, index === model.stats.length - 1 ? styles.statCellLast : {}]}>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {model.lines.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Conceptos</Text>
            <View style={{ marginBottom: 18 }}>
              <View style={styles.linesHead} fixed>
                <Text style={[styles.linesHeadText, styles.colTitle]}>Concepto</Text>
                <Text style={[styles.linesHeadText, styles.colQty]}>Cant.</Text>
                <Text style={[styles.linesHeadText, styles.colPrice]}>Precio</Text>
                <Text style={[styles.linesHeadText, styles.colDisc]}>Desc.</Text>
                <Text style={[styles.linesHeadText, styles.colTotal]}>Importe</Text>
              </View>
              {model.lines.map((line, index) => (
                <View key={index} style={styles.linesRow} wrap={false}>
                  <Text style={[styles.linesText, styles.colTitle]}>{line.title}</Text>
                  <Text style={[styles.linesText, styles.colQty]}>{line.qty}</Text>
                  <Text style={[styles.linesText, styles.colPrice]}>{line.unitPrice}</Text>
                  <Text style={[styles.linesText, styles.colDisc, line.discount ? styles.brandAccent : styles.linesMuted]}>{line.discount ? pdfText(line.discount) : "·"}</Text>
                  <Text style={[styles.linesText, styles.colTotal, styles.linesBold]}>{line.total}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{model.rowsTitle}</Text>
        <View style={styles.conditions}>
          {model.rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.sub ? <Text style={styles.rowSub}>{row.sub}</Text> : null}
              </View>
              <Text style={row.tone === "muted" ? styles.rowValueMuted : row.tone === "accent" ? [styles.rowValue, styles.brandAccent] : styles.rowValue}>
                {pdfText(row.value)}
              </Text>
            </View>
          ))}
        </View>

        {template.total === "block" ? (
          <View style={styles.totalBlock}>
            <Text style={[styles.totalLabel, styles.onBrand]}>{model.total.label}</Text>
            <Text style={[styles.totalValue, styles.onBrand]}>{model.total.value}</Text>
          </View>
        ) : (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{model.total.label}</Text>
            <Text style={[styles.totalValue, styles.brandAccent]}>{model.total.value}</Text>
          </View>
        )}

        {model.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesText}>{model.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>{model.disclaimer}</Text>
      </Page>

      {model.hasProperty ? (
        <Page size="A4" style={styles.page2}>
          <View style={styles.page2Header}>
            <View>
              <Text style={styles.page2Title}>{model.galleryTitle}</Text>
              <Text style={styles.page2Sub}>{model.tenantName}</Text>
            </View>
            <Text style={styles.page2Folio}>Folio {model.folio}</Text>
          </View>

          <Text style={styles.galleryLabel}>Plano de la propiedad</Text>
          <View style={styles.planBox}>
            {floorPlan ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={floorPlan} style={styles.planImage} />
            ) : (
              <Text style={styles.emptyText}>Plano no disponible</Text>
            )}
          </View>

          <Text style={styles.galleryLabel}>Galería</Text>
          {images.length > 0 ? (
            <View style={styles.grid}>
              {images.map((src) => (
                <View key={src} style={styles.cell}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={src} style={styles.cellPhoto} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Sin imágenes cargadas todavía.</Text>
          )}

          <Text style={styles.page2Footer}>{model.sheet2Footer}</Text>
        </Page>
      ) : null}
    </Document>
  );
}

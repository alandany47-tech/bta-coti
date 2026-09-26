import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import type { Property } from "@/lib/types";
import type { PricingBreakdown } from "@/lib/pricing";
import { BRAND } from "@/lib/brand";

const DARK = "#18181B";
const DARKER = "#09090B";
const LIGHT_BORDER = "#E4E4E7";
const MUTED = "#71717A";
const INK = "#18181B";

const styles = StyleSheet.create({
  // ---------------------------------------------------------------- Página 1
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  tenantBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
    objectFit: "contain",
  },
  tenantName: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  tenantTag: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaTitle: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
  },
  metaFolio: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  metaLine: {
    fontSize: 9,
    color: MUTED,
  },
  brandRule: {
    height: 2,
    marginBottom: 22,
  },
  propertyHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 18,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 3,
  },
  propertySubtitle: {
    fontSize: 10,
    color: MUTED,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#F4F4F5",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: MUTED,
  },
  priceHeadline: {
    alignItems: "flex-end",
  },
  priceHeadlineLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  priceHeadlineValue: {
    fontSize: 20,
    fontWeight: 700,
  },
  sectionLabel: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: DARK,
    borderRadius: 6,
    marginBottom: 26,
    overflow: "hidden",
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "#27272A",
  },
  statCellLast: {
    borderRightWidth: 0,
  },
  statLabel: {
    fontSize: 7,
    color: "#A1A1AA",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#FAFAFA",
  },
  conditionsBlock: {
    marginBottom: 22,
  },
  conditionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LIGHT_BORDER,
  },
  conditionLabel: {
    fontSize: 10,
    color: "#3F3F46",
  },
  conditionSubLabel: {
    fontSize: 8,
    color: MUTED,
  },
  conditionValue: {
    fontSize: 10,
    fontWeight: 700,
  },
  conditionValueMuted: {
    fontSize: 10,
    color: MUTED,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 700,
  },
  notesBlock: {
    marginBottom: 18,
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#F4F4F5",
  },
  notesText: {
    fontSize: 9,
    color: "#3F3F46",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 1.5,
  },

  // ---------------------------------------------------------------- Página 2
  darkPage: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: DARKER,
    color: "#FAFAFA",
  },
  darkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#27272A",
  },
  darkHeaderTitle: {
    fontSize: 13,
    fontWeight: 700,
  },
  darkHeaderSub: {
    fontSize: 8,
    color: "#A1A1AA",
    marginTop: 2,
  },
  darkHeaderFolio: {
    fontSize: 8,
    color: "#A1A1AA",
  },
  galleryLabel: {
    fontSize: 9,
    color: "#A1A1AA",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  floorPlanBox: {
    height: 220,
    borderRadius: 8,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  floorPlanImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  emptyBoxText: {
    fontSize: 9,
    color: "#52525B",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCell: {
    width: "31.4%",
    height: 110,
    borderRadius: 6,
    backgroundColor: "#18181B",
    borderWidth: 1,
    borderColor: "#27272A",
    overflow: "hidden",
  },
  imageCellPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  darkFooter: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7,
    color: "#52525B",
    textAlign: "center",
  },
});

function formatCurrencyPdf(amount: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatArea(m2: number) {
  return `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(m2)} m²`;
}

const STATUS_LABEL: Record<Property["status"], string> = {
  available: "Disponible",
  reserved: "Apartado",
  sold: "Vendido",
};

const STATUS_COLOR: Record<Property["status"], string> = {
  available: "#22C55E",
  reserved: "#F59E0B",
  sold: "#EF4444",
};

export type QuoteDocumentProps = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  brandColor?: string;
  advisorName?: string | null;
  quoteId: string;
  quoteNumber?: number | null;
  clientName: string;
  clientPhone: string;
  property: Property;
  breakdown: PricingBreakdown;
  installmentsCount: number;
  notes?: string | null;
  createdAt: string;
};

export function QuoteDocument({
  tenantName,
  tenantLogoUrl,
  brandColor = "#18181B",
  advisorName,
  quoteId,
  quoteNumber,
  clientName,
  clientPhone,
  property,
  breakdown,
  installmentsCount,
  notes,
  createdAt,
}: QuoteDocumentProps) {
  const folio = quoteNumber ? String(quoteNumber).padStart(4, "0") : quoteId.slice(0, 8).toUpperCase();
  const date = new Date(createdAt).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const stats: { label: string; value: string }[] = [
    { label: "Unidad", value: property.unit_number },
    { label: "M² Interiores", value: formatArea(property.m2_interior) },
    { label: "M² Exteriores", value: formatArea(property.m2_exterior) },
    { label: "M² Totales", value: formatArea(property.m2_total) },
    { label: "Estacionamientos", value: String(property.parking_spaces) },
  ];

  const hasFinalPayment = breakdown.finalPaymentAmount > 0.009;
  const hasDiscount = breakdown.discountAmount > 0.009;
  const previewImages = property.images.slice(0, 9);

  return (
    <Document>
      {/* ============================== Página 1 — Ficha financiera ============================== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.tenantBlock}>
            {tenantLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={tenantLogoUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.tenantName}>{tenantName}</Text>
              <Text style={styles.tenantTag}>Dossier inmobiliario</Text>
            </View>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaTitle}>Cotización ejecutiva</Text>
            <Text style={styles.metaFolio}>Folio {folio}</Text>
            <Text style={styles.metaLine}>{date}</Text>
            {advisorName ? (
              <Text style={styles.metaLine}>Asesor: {advisorName}</Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.brandRule, { backgroundColor: brandColor }]} />

        <View style={styles.propertyHero}>
          <View>
            <Text style={styles.propertyTitle}>{property.title}</Text>
            <Text style={styles.propertySubtitle}>
              Unidad {property.unit_number} · Preparado para {clientName}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: STATUS_COLOR[property.status] },
              ]}
            />
            <Text style={styles.statusText}>
              {STATUS_LABEL[property.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Características generales</Text>
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[
                styles.statCell,
                index === stats.length - 1 ? styles.statCellLast : {},
              ]}
            >
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Condiciones de venta</Text>
        <View style={styles.conditionsBlock}>
          <View style={styles.conditionRow}>
            <Text style={styles.conditionLabel}>Precio de lista</Text>
            <Text
              style={
                hasDiscount ? styles.conditionValueMuted : styles.conditionValue
              }
            >
              {formatCurrencyPdf(property.list_price)}
            </Text>
          </View>

          {hasDiscount ? (
            <View style={styles.conditionRow}>
              <View>
                <Text style={styles.conditionLabel}>Descuento aplicado</Text>
              </View>
              <Text style={[styles.conditionValue, { color: brandColor }]}>
                − {formatCurrencyPdf(breakdown.discountAmount)}
              </Text>
            </View>
          ) : null}

          <View style={styles.conditionRow}>
            <View>
              <Text style={styles.conditionLabel}>Enganche</Text>
              <Text style={styles.conditionSubLabel}>
                {breakdown.downPaymentAmount > 0
                  ? `${((breakdown.downPaymentAmount / breakdown.effectivePrice) * 100).toFixed(1)}% del precio`
                  : "Sin enganche"}
              </Text>
            </View>
            <Text style={styles.conditionValue}>
              {formatCurrencyPdf(breakdown.downPaymentAmount)}
            </Text>
          </View>

          <View style={styles.conditionRow}>
            <View>
              <Text style={styles.conditionLabel}>Mensualidades</Text>
              <Text style={styles.conditionSubLabel}>
                {installmentsCount} pagos mensuales
              </Text>
            </View>
            <Text style={styles.conditionValue}>
              {formatCurrencyPdf(breakdown.monthlyPaymentAmount)} / mes
            </Text>
          </View>

          {hasFinalPayment ? (
            <View style={styles.conditionRow}>
              <View>
                <Text style={styles.conditionLabel}>Saldo a escrituración</Text>
                <Text style={styles.conditionSubLabel}>
                  Pago único contra entrega
                </Text>
              </View>
              <Text style={styles.conditionValue}>
                {formatCurrencyPdf(breakdown.finalPaymentAmount)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total de la operación</Text>
          <Text style={[styles.totalValue, { color: brandColor }]}>
            {formatCurrencyPdf(breakdown.effectivePrice)}
          </Text>
        </View>

        {notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Cotización preparada por {tenantName} vía {BRAND.name} para {clientName}{" "}
          ({clientPhone}) — folio {folio}. Cifras informativas sujetas a
          disponibilidad, apartado y validación crediticia; no constituyen un
          contrato de compraventa.
        </Text>
      </Page>

      {/* ============================== Página 2 — Galería y plano ============================== */}
      <Page size="A4" style={styles.darkPage}>
        <View style={styles.darkHeader}>
          <View>
            <Text style={styles.darkHeaderTitle}>
              {property.title} · Unidad {property.unit_number}
            </Text>
            <Text style={styles.darkHeaderSub}>{tenantName}</Text>
          </View>
          <Text style={styles.darkHeaderFolio}>Folio {folio}</Text>
        </View>

        <Text style={styles.galleryLabel}>Plano de la propiedad</Text>
        <View style={styles.floorPlanBox}>
          {property.floor_plan_url ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={property.floor_plan_url} style={styles.floorPlanImage} />
          ) : (
            <Text style={styles.emptyBoxText}>Plano no disponible</Text>
          )}
        </View>

        <Text style={styles.galleryLabel}>Galería</Text>
        {previewImages.length > 0 ? (
          <View style={styles.imageGrid}>
            {previewImages.map((src) => (
              <View key={src} style={styles.imageCell}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={src} style={styles.imageCellPhoto} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyBoxText}>Sin imágenes cargadas todavía.</Text>
        )}

        <Text style={styles.darkFooter}>
          {tenantName} · Dossier generado vía {BRAND.name} · Folio {folio}
        </Text>
      </Page>
    </Document>
  );
}

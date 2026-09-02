import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import type { QuoteItem } from "@/lib/types";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#18181B",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
  },
  tenantBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    objectFit: "contain",
  },
  tenantName: {
    fontSize: 16,
    fontWeight: 700,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  muted: {
    color: "#71717A",
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 9,
    color: "#71717A",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  table: {
    borderWidth: 1,
    borderColor: "#E4E4E7",
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E4E7",
  },
  tableHeaderRow: {
    backgroundColor: "#F4F4F5",
  },
  cellName: { flex: 3, padding: 8 },
  cellQty: { flex: 1, padding: 8, textAlign: "right" },
  cellPrice: { flex: 1.4, padding: 8, textAlign: "right" },
  cellSubtotal: { flex: 1.4, padding: 8, textAlign: "right" },
  tableHeaderText: {
    fontSize: 8,
    color: "#71717A",
    textTransform: "uppercase",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E4E4E7",
  },
  totalLabel: {
    fontSize: 11,
    marginRight: 12,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#A1A1AA",
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

export type QuoteDocumentProps = {
  tenantName: string;
  tenantLogoUrl?: string | null;
  brandColor?: string;
  quoteId: string;
  clientName: string;
  clientPhone: string;
  items: QuoteItem[];
  totalAmount: number;
  createdAt: string;
};

export function QuoteDocument({
  tenantName,
  tenantLogoUrl,
  brandColor = "#18181B",
  quoteId,
  clientName,
  clientPhone,
  items,
  totalAmount,
  createdAt,
}: QuoteDocumentProps) {
  const folio = quoteId.slice(0, 8).toUpperCase();
  const date = new Date(createdAt).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: brandColor }]}>
          <View style={styles.tenantBlock}>
            {tenantLogoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={tenantLogoUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.tenantName}>{tenantName}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.title}>Cotización #{folio}</Text>
            <Text style={styles.muted}>{date}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cliente</Text>
          <Text>{clientName}</Text>
          <Text style={styles.muted}>{clientPhone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Detalle</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeaderRow]}>
              <Text style={[styles.cellName, styles.tableHeaderText]}>
                Producto
              </Text>
              <Text style={[styles.cellQty, styles.tableHeaderText]}>
                Cant.
              </Text>
              <Text style={[styles.cellPrice, styles.tableHeaderText]}>
                P. unitario
              </Text>
              <Text style={[styles.cellSubtotal, styles.tableHeaderText]}>
                Subtotal
              </Text>
            </View>
            {items.map((item, index) => (
              <View
                key={item.product_id}
                style={[
                  styles.tableRow,
                  index === items.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <Text style={styles.cellName}>
                  {item.name}
                  {"\n"}
                  <Text style={styles.muted}>{item.sku}</Text>
                </Text>
                <Text style={styles.cellQty}>{item.quantity}</Text>
                <Text style={styles.cellPrice}>
                  {formatCurrencyPdf(item.unit_price)}
                </Text>
                <Text style={styles.cellSubtotal}>
                  {formatCurrencyPdf(item.unit_price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, { color: brandColor }]}>
              {formatCurrencyPdf(totalAmount)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Cotización generada por {tenantName} vía BTA Cotiza — folio {folio}
        </Text>
      </Page>
    </Document>
  );
}

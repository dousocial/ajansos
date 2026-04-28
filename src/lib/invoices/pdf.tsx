import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { formatCurrency } from "./compute";

/**
 * PDF fatura üretimi (@react-pdf/renderer — headless browser yok, pure Node).
 *
 * Türk mevzuatı gereği fatura üzerinde: satıcı/alıcı adı-adresi-VKN/TCKN-vergi
 * dairesi, fatura numarası, düzenleme/vade tarihi, mal/hizmet açıklaması, KDV
 * oranı ve tutarı, toplam olmalı. Bu minimal layout temel alanları karşılıyor.
 *
 * NOT: E-fatura/GİB entegrasyonu yoktur — bu sadece PDF görsel çıktıdır. Resmi
 * e-Fatura yükümlülüğü varsa ayrı bir entegratör (Uyumsoft/Logo/Foriba) gerekir.
 */

export interface InvoicePdfData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  // Satıcı (ajans)
  sellerName: string;
  sellerAddress?: string | null;
  sellerTaxId?: string | null;
  sellerTaxOffice?: string | null;
  sellerEmail?: string | null;
  // Alıcı (müşteri)
  clientName: string;
  clientAddress?: string | null;
  clientTaxId?: string | null;
  clientTaxOffice?: string | null;
  clientEmail?: string | null;
  // Kalem — tek satırlık "hizmet" (bu MVP'de kalem tablosu yok)
  title: string;
  description?: string | null;
  currency: "TRY" | "USD" | "EUR";
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  // Alt kısım
  publicNote?: string | null;
  paymentMethod?: string | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    borderBottom: "2 solid #3b82f6",
    paddingBottom: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "right",
  },
  meta: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  partyBox: {
    width: "48%",
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  partyLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  partyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
  },
  partyLine: { fontSize: 9, marginBottom: 2, color: "#374151" },
  table: {
    marginBottom: 24,
    border: "1 solid #e5e7eb",
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderBottom: "1 solid #e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    padding: 10,
  },
  col1: { width: "60%", fontSize: 10 },
  col2: { width: "15%", fontSize: 10, textAlign: "right" },
  col3: { width: "25%", fontSize: 10, textAlign: "right", fontWeight: "bold" },
  totalsBox: {
    width: "40%",
    marginLeft: "auto",
    marginBottom: 24,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 4,
    fontSize: 10,
  },
  totalsGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    marginTop: 4,
    backgroundColor: "#3b82f6",
    color: "white",
    fontWeight: "bold",
    fontSize: 11,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 12,
    borderTop: "1 solid #e5e7eb",
    fontSize: 8,
    color: "#6b7280",
  },
});

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const fmt = (n: number) => formatCurrency(n, data.currency);
  const issueDate = data.issueDate.toLocaleDateString("tr-TR");
  const dueDate = data.dueDate.toLocaleDateString("tr-TR");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Başlık */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{data.sellerName}</Text>
            {data.sellerAddress && <Text style={styles.partyLine}>{data.sellerAddress}</Text>}
            {data.sellerTaxId && (
              <Text style={styles.partyLine}>
                VKN: {data.sellerTaxId}
                {data.sellerTaxOffice ? ` · ${data.sellerTaxOffice} V.D.` : ""}
              </Text>
            )}
            {data.sellerEmail && <Text style={styles.partyLine}>{data.sellerEmail}</Text>}
          </View>
          <View>
            <Text style={styles.title}>FATURA</Text>
            <Text style={styles.meta}>No: {data.invoiceNumber}</Text>
            <Text style={styles.meta}>Düzenleme: {issueDate}</Text>
            <Text style={styles.meta}>Vade: {dueDate}</Text>
          </View>
        </View>

        {/* Alıcı */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Fatura Kesilen</Text>
            <Text style={styles.partyName}>{data.clientName}</Text>
            {data.clientAddress && <Text style={styles.partyLine}>{data.clientAddress}</Text>}
            {data.clientTaxId && (
              <Text style={styles.partyLine}>
                {data.clientTaxId.length === 11 ? "TCKN" : "VKN"}: {data.clientTaxId}
                {data.clientTaxOffice ? ` · ${data.clientTaxOffice} V.D.` : ""}
              </Text>
            )}
            {data.clientEmail && <Text style={styles.partyLine}>{data.clientEmail}</Text>}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyLabel}>Ödeme</Text>
            <Text style={styles.partyLine}>Yöntem: {data.paymentMethod ?? "Havale / EFT"}</Text>
            <Text style={styles.partyLine}>Vade: {dueDate}</Text>
            {data.publicNote && <Text style={[styles.partyLine, { marginTop: 6 }]}>{data.publicNote}</Text>}
          </View>
        </View>

        {/* Kalem tablosu */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Açıklama</Text>
            <Text style={styles.col2}>KDV %</Text>
            <Text style={styles.col3}>Tutar</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.col1}>
              <Text style={{ fontWeight: "bold" }}>{data.title}</Text>
              {data.description && <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{data.description}</Text>}
            </View>
            <Text style={styles.col2}>%{data.vatRate}</Text>
            <Text style={styles.col3}>{fmt(data.amount)}</Text>
          </View>
        </View>

        {/* Toplamlar */}
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text>Ara Toplam (KDV Hariç)</Text>
            <Text>{fmt(data.amount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>KDV (%{data.vatRate})</Text>
            <Text>{fmt(data.vatAmount)}</Text>
          </View>
          <View style={styles.totalsGrand}>
            <Text>GENEL TOPLAM</Text>
            <Text>{fmt(data.totalAmount)}</Text>
          </View>
        </View>

        {/* Alt */}
        <View style={styles.footer}>
          <Text>
            Bu fatura {data.sellerName} tarafından elektronik olarak düzenlenmiştir. Ödemelerinizi lütfen yukarıdaki
            hesaba {dueDate} tarihine kadar yapınız.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/** PDF'i Node Buffer'a render eder. */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return await renderToBuffer(<InvoiceDocument data={data} />);
}

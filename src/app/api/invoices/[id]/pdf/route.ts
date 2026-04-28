import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { getAgencyInfo } from "@/lib/invoices/agency";

type Params = { params: Promise<{ id: string }> };

// GET /api/invoices/[id]/pdf — Fatura PDF'i indir
// Admin/Team faturayı önizleyebilir/indirir. Müşterilerin kendi PDF'i için
// /api/portal/invoices/[id]/pdf kullanılıyor (ayrı auth yolu).
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id, deletedAt: null },
    include: { client: true },
  });
  if (!invoice) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });

  const agency = getAgencyInfo();
  const buffer = await renderInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    sellerName: agency.name,
    sellerAddress: agency.address,
    sellerTaxId: agency.taxId,
    sellerTaxOffice: agency.taxOffice,
    sellerEmail: agency.email,
    clientName: invoice.client.name,
    clientAddress: invoice.client.billingAddress,
    clientTaxId: invoice.client.taxId,
    clientTaxOffice: invoice.client.taxOffice,
    clientEmail: invoice.client.contactEmail,
    title: invoice.title,
    description: invoice.description,
    currency: invoice.currency,
    amount: Number(invoice.amount),
    vatRate: Number(invoice.vatRate),
    vatAmount: Number(invoice.vatAmount),
    totalAmount: Number(invoice.totalAmount),
    publicNote: invoice.publicNote ?? (agency.iban ? `IBAN: ${agency.iban}` : null),
    paymentMethod: invoice.paymentMethod,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fatura-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

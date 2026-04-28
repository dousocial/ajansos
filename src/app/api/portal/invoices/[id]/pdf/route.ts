import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPortalToken } from "@/lib/portal-token";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { getAgencyInfo } from "@/lib/invoices/agency";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/portal/invoices/[id]/pdf — Müşteri kendi faturasını indirir.
 * DRAFT olanlar 403. Preview (?preview=...) ile ADMIN/TEAM de görebilir.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const previewToken = searchParams.get("preview");

  let allowedClientId: string | null = null;

  if (previewToken) {
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "CLIENT için preview kullanılmaz" }, { status: 400 });
    }
    const verified = await verifyPortalToken(previewToken);
    if (!verified) return NextResponse.json({ error: "Geçersiz preview linki" }, { status: 401 });
    allowedClientId = verified.clientId;
  } else {
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "Portal yalnızca müşterilere açıktır" }, { status: 403 });
    }
    const me = await prisma.client.findFirst({
      where: { contactEmail: session.user.email ?? "", deletedAt: null },
      select: { id: true },
    });
    if (!me) return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
    allowedClientId = me.id;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id, deletedAt: null },
    include: { client: true },
  });
  if (!invoice || invoice.clientId !== allowedClientId) {
    return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });
  }
  if (invoice.status === "DRAFT") {
    return NextResponse.json({ error: "Bu fatura henüz yayınlanmadı" }, { status: 403 });
  }

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
      "Content-Disposition": `attachment; filename="fatura-${invoice.invoiceNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

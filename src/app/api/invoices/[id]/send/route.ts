import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoices/pdf";
import { sendInvoiceEmail } from "@/lib/invoices/email";
import { getAgencyInfo } from "@/lib/invoices/agency";

type Params = { params: Promise<{ id: string }> };

// POST /api/invoices/[id]/send — Faturayı müşteriye e-postayla gönder
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id, deletedAt: null },
    include: { client: true },
  });
  if (!invoice) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });
  if (invoice.status === "CANCELLED") {
    return NextResponse.json({ error: "İptal edilmiş fatura gönderilemez" }, { status: 409 });
  }
  if (!invoice.client.contactEmail) {
    return NextResponse.json(
      { error: "Müşterinin e-posta adresi yok — önce müşteri bilgilerini güncelleyin" },
      { status: 422 }
    );
  }

  const agency = getAgencyInfo();
  const pdfBuffer = await renderInvoicePdf({
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

  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/faturalar/${invoice.id}`;

  const emailResult = await sendInvoiceEmail({
    to: invoice.client.contactEmail,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.client.name,
    sellerName: agency.name,
    dueDate: invoice.dueDate,
    totalAmount: Number(invoice.totalAmount),
    currency: invoice.currency,
    portalUrl,
    pdfBuffer,
  });

  if (!emailResult.ok && !("skipped" in emailResult)) {
    return NextResponse.json(
      { error: "E-posta gönderilemedi", details: emailResult.error },
      { status: 502 }
    );
  }

  // SENT olarak işaretle + bildirim oluştur
  const [updated] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
        sentAt: invoice.sentAt ?? new Date(),
      },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.notification.create({
      data: {
        clientId: invoice.clientId,
        type: "INVOICE_SENT",
        title: `Fatura gönderildi: ${invoice.invoiceNumber}`,
        body: `${invoice.client.name} müşterisine ${invoice.invoiceNumber} nolu fatura e-postayla iletildi.`,
        entityType: "Invoice",
        entityId: invoice.id,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "INVOICE_SENT",
        details: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          to: invoice.client.contactEmail,
          skipped: "skipped" in emailResult,
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: updated,
    email: emailResult,
  });
}

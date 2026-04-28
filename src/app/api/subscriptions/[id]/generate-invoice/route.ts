import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeAmounts } from "@/lib/invoices/compute";
import { nextInvoiceNumber } from "@/lib/invoices/numbering";
import { advanceInvoiceDate, defaultDueDate } from "@/lib/invoices/schedule";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/subscriptions/[id]/generate-invoice
 *
 * Bir abonelik için manuel fatura üretir (DRAFT). Her tıkta:
 *   1. Subscription'ın mevcut `nextInvoiceDate`'i ile yeni Invoice oluşturur
 *   2. `nextInvoiceDate`'i interval kadar (ay/3 ay/yıl) ileri taşır
 *
 * Bir sonraki tıkta zaten ileri alınmış tarih kullanılır → bir sonraki dönemin
 * faturası üretilir. Bu sayede ay ay manuel kesim akışı çalışır.
 *
 * Cron (generate-invoices) ile aynı mantık ama:
 *   - Bearer auth yerine NextAuth session
 *   - status ACTIVE şartı yumuşak (PAUSED da geçirilebilir? hayır — yine ACTIVE şartı)
 *   - Tek subscription → tek invoice
 *
 * Yetki: ADMIN ve TEAM. CLIENT erişemez.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;

  const sub = await prisma.subscription.findUnique({
    where: { id, deletedAt: null },
    include: { client: { select: { id: true, name: true } } },
  });

  if (!sub) {
    return NextResponse.json({ error: "Abonelik bulunamadı" }, { status: 404 });
  }
  if (sub.status !== "ACTIVE") {
    return NextResponse.json(
      { error: `Sadece aktif abonelikler için fatura üretilebilir (mevcut: ${sub.status})` },
      { status: 422 }
    );
  }
  if (sub.endDate && sub.endDate < new Date()) {
    return NextResponse.json(
      { error: "Aboneliğin bitiş tarihi geçmiş — yeni fatura üretilemez" },
      { status: 422 }
    );
  }

  try {
    const amounts = computeAmounts(Number(sub.amount), Number(sub.vatRate));
    const issueDate = new Date(sub.nextInvoiceDate);
    const dueDate = defaultDueDate(issueDate);
    let invoiceNumber = await nextInvoiceNumber(issueDate);

    let invoice;
    try {
      invoice = await prisma.invoice.create({
        data: {
          clientId: sub.clientId,
          subscriptionId: sub.id,
          invoiceNumber,
          title: sub.name,
          description: sub.description,
          currency: sub.currency,
          amount: amounts.amount,
          vatRate: amounts.vatRate,
          vatAmount: amounts.vatAmount,
          totalAmount: amounts.totalAmount,
          issueDate,
          dueDate,
          publicNote: sub.notes,
        },
      });
    } catch (e) {
      // Unique çakışması (eş zamanlı kesim) → numara yenile + tek retry
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique") || msg.includes("invoiceNumber")) {
        invoiceNumber = await nextInvoiceNumber(issueDate);
        invoice = await prisma.invoice.create({
          data: {
            clientId: sub.clientId,
            subscriptionId: sub.id,
            invoiceNumber,
            title: sub.name,
            description: sub.description,
            currency: sub.currency,
            amount: amounts.amount,
            vatRate: amounts.vatRate,
            vatAmount: amounts.vatAmount,
            totalAmount: amounts.totalAmount,
            issueDate,
            dueDate,
            publicNote: sub.notes,
          },
        });
      } else {
        throw e;
      }
    }

    // nextInvoiceDate'i bir sonraki dönem için ileri al
    const newNext = advanceInvoiceDate(sub.nextInvoiceDate, sub.interval);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { nextInvoiceDate: newNext },
    });

    // Aktivite log
    await prisma.activityLog
      .create({
        data: {
          userId: session.user.id,
          action: "invoice.generated_manual",
          details: {
            subscriptionId: sub.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            issueDate: issueDate.toISOString(),
          },
        },
      })
      .catch(() => {});

    // Bildirim
    await prisma.notification
      .create({
        data: {
          clientId: sub.clientId,
          type: "INVOICE_SENT",
          title: `Yeni fatura taslağı: ${invoice.invoiceNumber}`,
          body: `${sub.client.name} aboneliği için manuel fatura taslağı oluşturuldu.`,
          entityType: "Invoice",
          entityId: invoice.id,
        },
      })
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate.toISOString(),
        totalAmount: invoice.totalAmount.toString(),
        currency: invoice.currency,
      },
      nextInvoiceDate: newNext.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    logger.error("subscription.generate_invoice_failed", { subscriptionId: id, err: e });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

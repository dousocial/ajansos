import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Aktif abonelikleri dönüp `nextInvoiceDate <= now` olanlar için otomatik fatura
 * oluşturur (DRAFT olarak). Sonra `nextInvoiceDate`'i interval kadar ileri alır.
 *
 * Admin isterse DRAFT'ı gözden geçirip `POST /api/invoices/[id]/send` ile
 * gönderir; otomatik e-posta göndermiyoruz çünkü ajans doğrulamak isteyebilir.
 *
 * Cron önerisi: günde 1 kere (ör. 09:00 UTC). Vercel cron:
 *   { "path": "/api/cron/generate-invoices", "schedule": "0 9 * * *" }
 */

interface GenResult {
  subscriptionId: string;
  ok: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  skipped?: string;
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prisma } = await import("@/lib/prisma");
  const { computeAmounts } = await import("@/lib/invoices/compute");
  const { nextInvoiceNumber } = await import("@/lib/invoices/numbering");
  const { advanceInvoiceDate, defaultDueDate } = await import("@/lib/invoices/schedule");

  const now = new Date();
  const results: GenResult[] = [];

  const dueSubs = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      nextInvoiceDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    include: { client: { select: { id: true, name: true } } },
  });

  for (const sub of dueSubs) {
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
        // Unique çakışması → yeni numara + tek retry
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

      // nextInvoiceDate'i bir sonraki dönem için ilerlet
      const newNext = advanceInvoiceDate(sub.nextInvoiceDate, sub.interval);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { nextInvoiceDate: newNext },
      });

      // Admin'e bildirim
      await prisma.notification.create({
        data: {
          clientId: sub.clientId,
          type: "INVOICE_SENT", // "oluşturuldu" için ayrı tip yok, SENT ile eşitledik
          title: `Yeni fatura taslağı: ${invoice.invoiceNumber}`,
          body: `${sub.client.name} aboneliği için otomatik fatura taslağı oluşturuldu. Göndermek için kontrol edin.`,
          entityType: "Invoice",
          entityId: invoice.id,
        },
      });

      results.push({ subscriptionId: sub.id, ok: true, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("cron.generate_invoices.subscription_failed", {
        subscriptionId: sub.id,
        err: e,
      });
      results.push({ subscriptionId: sub.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

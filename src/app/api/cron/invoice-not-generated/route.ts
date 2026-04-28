import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Aboneliği olan müşteriler için: bir sonraki fatura kesim tarihine 1 hafta
 * (7 gün) kala henüz fatura oluşturulmamışsa ekibi bildirimle uyarır.
 *
 * Not: generate-invoices cron'u kesim tarihinde otomatik fatura keser. Bu cron
 * onun safety net'i — manuel müdahale gereken durumlar (subscription PAUSED,
 * tutar değişikliği bekleyen, vb.) gözden kaçmasın diye.
 *
 * Cron: günde 1 kere (08:00 UTC).
 *   { "path": "/api/cron/invoice-not-generated", "schedule": "0 8 * * *" }
 */

const NOTIFY_DAYS_BEFORE = 7;
const MIN_DAYS_BETWEEN_REMINDERS = 6; // tek bir uyarı yeterli

interface Result {
  subscriptionId: string;
  clientName: string;
  nextInvoiceDate: string;
  ok: boolean;
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

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + NOTIFY_DAYS_BEFORE);

  // Yaklaşan kesim tarihli aktif abonelikler
  const subs = await prisma.subscription.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      nextInvoiceDate: { gte: now, lte: cutoff },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  const results: Result[] = [];

  for (const sub of subs) {
    try {
      // Bu döneme ait fatura zaten kesildi mi? (issueDate >= last cycle start)
      // Basit kontrol: sub.nextInvoiceDate'den önceki 30 gün içinde
      // bu subscription'a bağlı bir invoice var mı.
      const cycleStart = new Date(sub.nextInvoiceDate);
      cycleStart.setDate(cycleStart.getDate() - 30);

      const recentInvoice = await prisma.invoice.findFirst({
        where: {
          subscriptionId: sub.id,
          deletedAt: null,
          issueDate: { gte: cycleStart },
        },
      });

      if (recentInvoice) {
        results.push({
          subscriptionId: sub.id,
          clientName: sub.client.name,
          nextInvoiceDate: sub.nextInvoiceDate.toISOString(),
          ok: true,
          skipped: "already_invoiced",
        });
        continue;
      }

      // Son uyarı yakın zamanda yapıldıysa atla
      const lastNotif = await prisma.notification.findFirst({
        where: {
          entityType: "Subscription",
          entityId: sub.id,
          type: "INVOICE_NOT_GENERATED",
        },
        orderBy: { createdAt: "desc" },
      });
      if (lastNotif) {
        const daysSince = (now.getTime() - lastNotif.createdAt.getTime()) / 86400000;
        if (daysSince < MIN_DAYS_BETWEEN_REMINDERS) {
          results.push({
            subscriptionId: sub.id,
            clientName: sub.client.name,
            nextInvoiceDate: sub.nextInvoiceDate.toISOString(),
            ok: true,
            skipped: "too_soon",
          });
          continue;
        }
      }

      const daysLeft = Math.ceil(
        (sub.nextInvoiceDate.getTime() - now.getTime()) / 86400000
      );

      // Bildirim — clientId ile (ekibe görünür) kaydet.
      await prisma.notification.create({
        data: {
          clientId: sub.clientId,
          type: "INVOICE_NOT_GENERATED",
          title: `Fatura kesilmedi: ${sub.client.name}`,
          body: `${sub.name} aboneliğinin kesim tarihine ${daysLeft} gün kaldı ama fatura henüz oluşturulmadı.`,
          entityType: "Subscription",
          entityId: sub.id,
        },
      });

      results.push({
        subscriptionId: sub.id,
        clientName: sub.client.name,
        nextInvoiceDate: sub.nextInvoiceDate.toISOString(),
        ok: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("cron.invoice_not_generated.failed", {
        subscriptionId: sub.id,
        err: e,
      });
      results.push({
        subscriptionId: sub.id,
        clientName: sub.client.name,
        nextInvoiceDate: sub.nextInvoiceDate.toISOString(),
        ok: false,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    notified: results.filter((r) => r.ok && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Vadesi yaklaşan (3 gün içinde) ve geciken SENT faturalar için hatırlatma
 * e-postası gönderir, gecikmiş olanları OVERDUE durumuna alır.
 *
 * Cron: günde 1 kere (09:30 UTC).
 *   { "path": "/api/cron/invoice-reminders", "schedule": "30 9 * * *" }
 *
 * Çok sık göndermemek için: son `sentAt` + hatırlatma arasında en az 3 gün
 * olmasını bekliyoruz (basit heuristic: notification'da entityId eşleşmesi var mı).
 */

interface ReminderResult {
  invoiceId: string;
  invoiceNumber: string;
  kind: "due_soon" | "overdue";
  ok: boolean;
  skipped?: string;
  email?: string;
  error?: string;
}

const DUE_SOON_DAYS = 3;
const MIN_DAYS_BETWEEN_REMINDERS = 3;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prisma } = await import("@/lib/prisma");
  const { sendReminderEmail } = await import("@/lib/invoices/email");

  const now = new Date();
  const soonCutoff = new Date(now);
  soonCutoff.setDate(soonCutoff.getDate() + DUE_SOON_DAYS);
  const results: ReminderResult[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // 1) Vadesi geçmiş SENT faturaları OVERDUE'ya al
  await prisma.invoice.updateMany({
    where: {
      status: "SENT",
      dueDate: { lt: now },
      deletedAt: null,
    },
    data: { status: "OVERDUE" },
  });

  // 2) Hatırlatma adayları: SENT (due_soon) + OVERDUE (gecikme)
  const candidates = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: "SENT", dueDate: { lte: soonCutoff, gte: now } },
        { status: "OVERDUE" },
      ],
    },
    include: {
      client: { select: { id: true, name: true, contactEmail: true } },
    },
  });

  for (const invoice of candidates) {
    try {
      if (!invoice.client.contactEmail) {
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          kind: invoice.status === "OVERDUE" ? "overdue" : "due_soon",
          ok: false,
          skipped: "client_no_email",
        });
        continue;
      }

      // En son bildirimden bu yana yeterli süre geçti mi?
      const lastNotif = await prisma.notification.findFirst({
        where: {
          entityType: "Invoice",
          entityId: invoice.id,
          type: { in: ["INVOICE_DUE_SOON", "INVOICE_OVERDUE"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (lastNotif) {
        const daysSince = (now.getTime() - lastNotif.createdAt.getTime()) / 86400000;
        if (daysSince < MIN_DAYS_BETWEEN_REMINDERS) {
          results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            kind: invoice.status === "OVERDUE" ? "overdue" : "due_soon",
            ok: false,
            skipped: "too_soon",
          });
          continue;
        }
      }

      const daysUntilDue = Math.floor((invoice.dueDate.getTime() - now.getTime()) / 86400000);
      const kind: "due_soon" | "overdue" = invoice.status === "OVERDUE" || daysUntilDue < 0 ? "overdue" : "due_soon";
      const portalUrl = `${appUrl}/portal/faturalar/${invoice.id}`;

      const emailRes = await sendReminderEmail({
        to: invoice.client.contactEmail,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        sellerName: process.env.AGENCY_NAME ?? "AjansOS",
        dueDate: invoice.dueDate,
        daysUntilDue,
        totalAmount: Number(invoice.totalAmount),
        currency: invoice.currency,
        portalUrl,
      });

      // Notification her halükarda (skipped dahil) oluştur — audit için
      await prisma.notification.create({
        data: {
          clientId: invoice.clientId,
          type: kind === "overdue" ? "INVOICE_OVERDUE" : "INVOICE_DUE_SOON",
          title:
            kind === "overdue"
              ? `Gecikmiş fatura: ${invoice.invoiceNumber}`
              : `Vadesi yaklaşan fatura: ${invoice.invoiceNumber}`,
          body:
            kind === "overdue"
              ? `${invoice.client.name} için ${invoice.invoiceNumber} nolu fatura vadesi geçti.`
              : `${invoice.client.name} için ${invoice.invoiceNumber} nolu faturanın vadesi ${daysUntilDue} gün sonra.`,
          entityType: "Invoice",
          entityId: invoice.id,
        },
      });

      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        kind,
        ok: emailRes.ok,
        email: invoice.client.contactEmail,
        ...("skipped" in emailRes ? { skipped: emailRes.reason } : {}),
        ...(!emailRes.ok && "error" in emailRes ? { error: emailRes.error } : {}),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("cron.invoice_reminders.failed", {
        invoiceId: invoice.id,
        err: e,
      });
      results.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        kind: "due_soon",
        ok: false,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    succeeded: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.ok && !r.skipped).length,
    results,
  });
}

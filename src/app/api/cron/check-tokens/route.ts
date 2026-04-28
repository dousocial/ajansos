import { NextRequest, NextResponse } from "next/server";
import { sendNotificationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Sosyal hesap token süresi dolmaya yaklaşanları tespit edip TOKEN_EXPIRING
 * bildirimi atar.
 *
 * Senaryo:
 *  - Meta Page tokenları kalıcı (asla expire olmaz) → tokenExpiresAt null kalır,
 *    bu cron onları atlar.
 *  - Meta User Long-Lived: ~60 gün; LinkedIn: ~60 gün; YouTube/Google: 1 saat
 *    access + 6 ay refresh; TikTok: ~24 saat access + 365 gün refresh.
 *  - YouTube/TikTok/LinkedIn refresh logic henüz yok → kullanıcı manuel
 *    yeniden bağlamalı; bu yüzden 7 gün önceden uyarmak istiyoruz.
 *
 * Spam koruması: aynı SocialAccount için son 24 saatte aynı tip notification
 * varsa tekrar atmıyoruz (NotificationType.TOKEN_EXPIRING + entityType
 * "SocialAccount" + entityId).
 *
 * Vercel cron önerisi:
 *   { "path": "/api/cron/check-tokens", "schedule": "0 8 * * *" }  // günde 1
 */

interface ResultItem {
  socialAccountId: string;
  platform: string;
  expiresAt: string;
  daysLeft: number;
  notified: boolean;
  reason?: string;
}

const WARN_DAYS = 7;
const RENOTIFY_HOURS = 24;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prisma } = await import("@/lib/prisma");
  const now = new Date();
  const warnUntil = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  // Süresi yaklaşmış (veya geçmiş) tüm hesaplar
  const accounts = await prisma.socialAccount.findMany({
    where: {
      tokenExpiresAt: { not: null, lte: warnUntil },
      // Müşteri silinmişse atla (Cascade onDelete olduğu için zaten gelmez ama defansif).
      client: { deletedAt: null },
    },
    select: {
      id: true,
      platform: true,
      accountName: true,
      tokenExpiresAt: true,
      clientId: true,
      client: { select: { name: true } },
    },
  });

  const results: ResultItem[] = [];

  for (const acc of accounts) {
    if (!acc.tokenExpiresAt) continue;
    const msLeft = acc.tokenExpiresAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    // Son 24 saat içinde bu hesap için zaten bildirim atılmış mı?
    const renotifyCutoff = new Date(now.getTime() - RENOTIFY_HOURS * 60 * 60 * 1000);
    const recent = await prisma.notification.findFirst({
      where: {
        type: "TOKEN_EXPIRING",
        entityType: "SocialAccount",
        entityId: acc.id,
        createdAt: { gte: renotifyCutoff },
      },
      select: { id: true },
    });
    if (recent) {
      results.push({
        socialAccountId: acc.id,
        platform: acc.platform,
        expiresAt: acc.tokenExpiresAt.toISOString(),
        daysLeft,
        notified: false,
        reason: "son 24 saatte zaten bildirim atılmış",
      });
      continue;
    }

    // Hedef kullanıcılar: müşteri ekibi (TeamAssignment) + tüm ADMIN'ler.
    const [assignments, admins] = await Promise.all([
      prisma.teamAssignment.findMany({
        where: { clientId: acc.clientId },
        select: { userId: true },
      }),
      prisma.user.findMany({
        where: { role: "ADMIN", deletedAt: null },
        select: { id: true },
      }),
    ]);
    const userIds = new Set<string>([
      ...assignments.map((a) => a.userId),
      ...admins.map((a) => a.id),
    ]);

    if (userIds.size === 0) {
      results.push({
        socialAccountId: acc.id,
        platform: acc.platform,
        expiresAt: acc.tokenExpiresAt.toISOString(),
        daysLeft,
        notified: false,
        reason: "hedef kullanıcı yok",
      });
      continue;
    }

    const expired = msLeft <= 0;
    const title = expired
      ? `${acc.platform} bağlantısı süresi doldu`
      : `${acc.platform} bağlantısı ${daysLeft} gün içinde dolacak`;
    const body = `${acc.client.name} → ${acc.accountName}. ${
      expired
        ? "Yayınlar başarısız olacak. Müşteri ayarlarından yeniden bağlayın."
        : "Süre dolmadan müşteri ayarlarından yeniden bağlamanızı öneririz."
    }`;

    await prisma.notification.createMany({
      data: Array.from(userIds).map((userId) => ({
        userId,
        clientId: acc.clientId,
        type: "TOKEN_EXPIRING" as const,
        title,
        body,
        entityType: "SocialAccount",
        entityId: acc.id,
      })),
    });

    // E-posta bildirimi (best-effort) — sadece ADMIN'lere, in-app bildirimle
    // birlikte. RESEND yoksa atlar; hata cron'u durdurmaz.
    try {
      const adminEmails = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) }, role: "ADMIN", email: { not: "" } },
        select: { email: true },
      });
      const to = adminEmails.map((u) => u.email).filter(Boolean);
      if (to.length > 0) {
        await sendNotificationEmail({
          to,
          subject: title,
          heading: title,
          lines: [body],
          ctaText: "Müşteri ayarlarına git",
          ctaUrl: `${env.NEXT_PUBLIC_APP_URL}/musteriler/${acc.clientId}`,
          variant: expired ? "danger" : "warning",
        });
      }
    } catch (emailErr) {
      logger.warn("cron.check_tokens.email_failed", {
        socialAccountId: acc.id,
        err: emailErr,
      });
    }

    results.push({
      socialAccountId: acc.id,
      platform: acc.platform,
      expiresAt: acc.tokenExpiresAt.toISOString(),
      daysLeft,
      notified: true,
    });
  }

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    accounts: accounts.length,
    notified: results.filter((r) => r.notified).length,
    skipped: results.filter((r) => !r.notified).length,
    results,
  });
}

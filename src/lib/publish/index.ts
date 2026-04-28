/**
 * Platform-agnostic publish dispatcher.
 *
 * ScheduledPost.platform'a göre doğru publish fonksiyonuna yönlendirir. Token
 * çözme (AES-GCM) ve DB güncellemeleri burada merkezi yapılır — platform
 * modülleri sadece API çağrısıyla ilgilenir.
 *
 * Kullanım:
 *   import { dispatchPublish } from "@/lib/publish";
 *   const result = await dispatchPublish(scheduledPostId);
 *   // { ok: true, externalId } veya { ok: false, error }
 *
 * Çağrı yerleri:
 *  - /api/meta/post/route.ts — manuel "Şimdi Yayınla" butonu
 *  - /api/cron/publish — zamanlanmış cron (scheduledAt geçmiş postları)
 *
 * Başarıda ScheduledPost'u `status=published, publishedAt=now, externalId` yapar.
 * Hatada `status=failed, retryCount++, lastError=msg` yazar ve hata objesini döner
 * (caller uygun HTTP status'a çevirebilir).
 */

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { publishFacebook, publishInstagram } from "./meta";
import { publishLinkedIn } from "./linkedin";
import { publishTikTok } from "./tiktok";
import { publishYouTube } from "./youtube";
import type { ExternalId, PublishContext, PublishPostType } from "./types";

export type PublishResult =
  | { ok: true; externalId: ExternalId; platform: string }
  | { ok: false; error: string; platform: string };

/**
 * Bir ScheduledPost'u platform API'sine gönderir ve DB'yi günceller.
 * Dönüş tipi HTTP katmanında statusCode seçmek için discriminated union.
 */
export async function dispatchPublish(scheduledPostId: string): Promise<PublishResult> {
  // IDEMPOTENCY — daha önce başarıyla yayınlanmış post tekrar tetiklenirse
  // (örn. cron retry'ı + manuel button paralel çalışırsa, ya da DB update fail
  // sonrası ikinci attempt) externalId kaydı varsa erken çıkıyoruz. Aksi halde
  // platform'a tekrar gider, aynı post 2x yayınlanır.
  const existing = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    select: { status: true, externalId: true, platform: true },
  });
  if (existing?.status === "published" && existing.externalId) {
    return {
      ok: true,
      externalId: existing.externalId,
      platform: existing.platform,
    };
  }

  // ATOMIC CLAIM — yarış koşulunu kapatır.
  // "Şimdi Yayınla" butonu + cron aynı pending row'u eş zamanlı işleyebilir;
  // updateMany WHERE filtresi sadece ilk kazananın geçişini başarılı sayar
  // (etkilenen 0 satır → başkası aldı, sessizce çık).
  const claim = await prisma.scheduledPost.updateMany({
    where: { id: scheduledPostId, status: { in: ["pending", "failed"] } },
    data: { status: "publishing" },
  });
  if (claim.count === 0) {
    return {
      ok: true,
      externalId: "",
      platform: "claimed-by-other",
    };
  }

  const scheduledPost = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: {
      socialAccount: true,
      project: { select: { postType: true } },
    },
  });

  if (!scheduledPost) {
    return { ok: false, error: "ScheduledPost bulunamadı", platform: "unknown" };
  }

  const { socialAccount, project, platform } = scheduledPost;
  const postType = (project.postType ?? "IMAGE") as PublishPostType;

  try {
    const accessToken = decryptToken(socialAccount.accessTokenEnc);
    const captionParts: string[] = [];
    if (scheduledPost.caption) captionParts.push(scheduledPost.caption);
    if (scheduledPost.hashtags.length > 0) captionParts.push(...scheduledPost.hashtags);
    const caption = captionParts.join("\n\n");

    const ctx: PublishContext = {
      accessToken,
      accountId: socialAccount.accountId,
      pageId: socialAccount.pageId,
      instagramId: socialAccount.instagramId,
      caption,
      mediaUrls: scheduledPost.mediaUrls,
      postType,
    };

    let externalId: ExternalId;
    switch (platform) {
      case "INSTAGRAM":
        externalId = await publishInstagram(ctx);
        break;
      case "FACEBOOK":
        externalId = await publishFacebook(ctx);
        break;
      case "LINKEDIN":
        externalId = await publishLinkedIn(ctx);
        break;
      case "YOUTUBE":
        externalId = await publishYouTube(ctx);
        break;
      case "TIKTOK":
        externalId = await publishTikTok(ctx);
        break;
      default:
        throw new Error(`Bu platform henüz desteklenmiyor: ${platform}`);
    }

    // externalId kaydı: tekrar dispatch edilirse idempotency guard burayı
    // kullanır + insights cron'u bu ID üzerinden Meta/LI Insights API'ye sorar.
    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: {
        status: "published",
        publishedAt: new Date(),
        externalId: typeof externalId === "string" ? externalId : String(externalId),
        lastError: null,
      },
    });

    // Project status sync: bu projeye ait TÜM ScheduledPost'lar published ise
    // Project.status = PUBLISHED. En az bir tanesi hâlâ pending/failed/publishing
    // ise APPROVED/LIVE'da kalır. Race-safe: count sorgusu kendi başına atomic.
    try {
      const remaining = await prisma.scheduledPost.count({
        where: {
          projectId: scheduledPost.projectId,
          status: { not: "published" },
        },
      });
      if (remaining === 0) {
        await prisma.project.update({
          where: { id: scheduledPost.projectId },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
      } else {
        // En azından bir post yayında → LIVE (üretim sürecindeki "yayında" durumu)
        await prisma.project.updateMany({
          where: { id: scheduledPost.projectId, status: "APPROVED" },
          data: { status: "LIVE" },
        });
      }
    } catch (syncErr) {
      // Project status sync'i kritik değil — yayın zaten gitti, sadece
      // pipeline durumu geri kalır. Loglayıp swallow ediyoruz.
      logger.warn("publish.project_sync_failed", {
        scheduledPostId,
        projectId: scheduledPost.projectId,
        err: syncErr,
      });
    }

    return { ok: true, externalId, platform };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);

    // Failure kaydı — DB yazılamazsa swallow (loglanır)
    try {
      await prisma.scheduledPost.update({
        where: { id: scheduledPostId },
        data: {
          status: "failed",
          retryCount: { increment: 1 },
          lastError: errMsg.slice(0, 500),
        },
      });
    } catch (dbErr) {
      logger.error("publish.db_update_failed", {
        scheduledPostId,
        platform,
        err: dbErr,
      });
    }

    // Bildirim: client'a atanmış team üyeleri + tüm ADMIN'ler.
    // notification.create() bir publish flow'unu bloklamasın diye bütün
    // bildirim akışını try/catch içinde tutuyoruz; swallow + log.
    try {
      await createPostFailedNotifications({
        scheduledPostId,
        platform,
        errMsg,
        clientId: scheduledPost.socialAccount.clientId,
        projectId: scheduledPost.projectId,
      });
    } catch (notifErr) {
      logger.error("publish.notification_failed", {
        scheduledPostId,
        platform,
        err: notifErr,
      });
    }

    logger.error("publish.failed", {
      scheduledPostId,
      platform,
      err: e,
    });
    return { ok: false, error: errMsg, platform };
  }
}

async function createPostFailedNotifications(args: {
  scheduledPostId: string;
  platform: string;
  errMsg: string;
  clientId: string;
  projectId: string;
}) {
  // Hedef kullanıcı kümesi: client'a atanmış team üyeleri + ADMIN'ler.
  const [assignments, admins] = await Promise.all([
    prisma.teamAssignment.findMany({
      where: { clientId: args.clientId },
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
  if (userIds.size === 0) return;

  const titleBase = `${args.platform} yayını başarısız`;
  const body = args.errMsg.slice(0, 300);
  await prisma.notification.createMany({
    data: Array.from(userIds).map((userId) => ({
      userId,
      clientId: args.clientId,
      type: "POST_FAILED" as const,
      title: titleBase,
      body,
      entityType: "ScheduledPost",
      entityId: args.scheduledPostId,
    })),
  });
}

export type { PublishContext, PublishPostType, ExternalId } from "./types";

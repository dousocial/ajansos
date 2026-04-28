/**
 * Cron tetikleyici — vadesi gelmiş ScheduledPost'ları işler.
 *
 * Önemli mimari değişiklikler:
 *  • Eskiden kendi `/api/meta/post` endpoint'ine HTTP fetch ediyordu — bu hem
 *    gereksiz network round-trip'iydi hem de fetch throw ettiğinde
 *    `dispatchPublish`'in DB güncellemesinin üstüne çift `retryCount++` yazıyordu.
 *    Artık `dispatchPublish` doğrudan in-process çağrılıyor.
 *  • Race koruması: `dispatchPublish` başında atomic claim var; "Şimdi Yayınla"
 *    UI butonu ile aynı anda fırlasak bile çift post atmaz.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { dispatchPublish } from "@/lib/publish";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

// Backoff: delay = BASE_DELAY_MS * 2^retryCount → 5dk, 10dk, 20dk, 40dk, 80dk.
// retryCount MAX_RETRIES'a ulaşırsa post kalıcı olarak failed kalır.
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 5 * 60 * 1000;

const backoffDelayMs = (n: number) => BASE_DELAY_MS * 2 ** Math.max(0, n);

/**
 * Sabit-zamanlı Bearer token karşılaştırması (timing attack koruması).
 * `===` erken çıkışlı; uzaktan ölçümle secret çıkarımı teorik olarak mümkün.
 */
function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface PostResult {
  scheduledPostId: string;
  ok: boolean;
  skipped?: "backoff";
  error?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  let candidates: { id: string; status: string; retryCount: number; updatedAt: Date }[];
  try {
    candidates = await prisma.scheduledPost.findMany({
      where: {
        scheduledAt: { lte: now },
        OR: [
          { status: "pending" },
          { status: "failed", retryCount: { lt: MAX_RETRIES } },
        ],
      },
      select: { id: true, status: true, retryCount: true, updatedAt: true },
    });
  } catch (e) {
    logger.error("cron.publish.db_error", { err: e });
    return NextResponse.json({ error: "İşlem başarısız oldu" }, { status: 500 });
  }

  // Paralel dispatch — her dispatchPublish kendi DB güncellemesini ve retry
  // logic'ini içeriyor. Atomic claim yarış koşulundan koruduğu için Promise.all
  // güvenli.
  const results: PostResult[] = await Promise.all(
    candidates.map(async (post) => {
      // Backoff: failed post için bekleme süresi henüz dolmadıysa atla.
      if (
        post.status === "failed" &&
        now.getTime() - post.updatedAt.getTime() < backoffDelayMs(post.retryCount)
      ) {
        return { scheduledPostId: post.id, ok: false, skipped: "backoff" as const };
      }
      const r = await dispatchPublish(post.id);
      return {
        scheduledPostId: post.id,
        ok: r.ok,
        error: r.ok ? undefined : r.error,
      };
    })
  );

  const attempted = results.filter((r) => !r.skipped).length;
  return NextResponse.json({
    ok: true,
    processed: results.length,
    attempted,
    succeeded: results.filter((r) => r.ok).length,
    skipped: results.length - attempted,
    results,
  });
}

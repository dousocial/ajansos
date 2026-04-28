/**
 * Manuel "Şimdi Yayınla" tetikleyicisi.
 *
 * İki giriş yolu kabul ediyoruz:
 *  1. Cron iç çağrı: Bearer ${CRON_SECRET} (sabit-zamanlı karşılaştırma)
 *  2. UI: NextAuth oturumu (CLIENT rolü hariç)
 *
 * Yayın mantığı `lib/publish/dispatchPublish` içinde — bu route HTTP kabuğu.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { dispatchPublish } from "@/lib/publish";

export const runtime = "nodejs";

const Body = z.object({ scheduledPostId: z.string().min(1) });

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
    }
  }

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "scheduledPostId zorunlu" },
      { status: 400 }
    );
  }

  const result = await dispatchPublish(parsed.data.scheduledPostId);

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      externalId: result.externalId,
      platform: result.platform,
    });
  }

  // dispatchPublish "bulunamadı" sentinel'ini özel mesajla dönüyor → 404
  const status = result.error === "ScheduledPost bulunamadı" ? 404 : 500;
  return NextResponse.json(
    { ok: false, error: result.error, platform: result.platform },
    { status }
  );
}

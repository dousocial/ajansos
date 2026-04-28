/**
 * Cron — yayınlanmış post'ların kaynak medyasını Supabase Storage'dan temizler.
 *
 * Mantık:
 *  • Bir Project'in TÜM ScheduledPost'ları `published` ve son yayından bu yana
 *    `RETENTION_DAYS` geçmişse → o projenin File'ları silinmeye uygundur.
 *  • Eğer projenin pending/failed/publishing post'u varsa → DOKUNMA
 *    (sonradan IG re-publish gerekebilir, hâlâ kaynağa ihtiyaç var).
 *  • Silme: Supabase storage objesi + File satırında `deletedAt` set.
 *
 * Neden Storage'dan siliyoruz: IG/FB yayını yaptıktan sonra videoyu kendi CDN'ine
 * kopyalıyor; bizdeki kopya artık dead weight. Free tier 1 GB; Pro 100 GB —
 * temizlik yapmazsak 5 marka × 1 video/gün senaryosunda Pro bile birkaç ayda dolar.
 *
 * Schedule: günde 1x yeterli — vercel.json'da `0 3 * * *` (her gün 03:00 UTC).
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deleteFromSupabase } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

// Yayın sonrası tutma süresi. 7 gün: hata kurtarma + iş günü içinde fark
// edilmesi için makul tampon. Daha agresif istenirse (3 gün) düşürülebilir.
const RETENTION_DAYS = 7;

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Adayları bul: TÜM scheduledPost'ları published VE en geç yayın cutoff'tan
  // önce olan projeler. Negatif filtre (none pending/failed) DB'de kolay
  // ifade edilemediği için aday seti çekip JS'te eleyeceğiz.
  const candidateProjects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      scheduledPosts: { some: { status: "published" } },
      // En az bir File'ı henüz silinmemiş olan projeler
      files: { some: { deletedAt: null } },
    },
    select: {
      id: true,
      scheduledPosts: {
        select: { status: true, publishedAt: true },
      },
      files: {
        where: { deletedAt: null },
        select: { id: true, storageKey: true, sizeBytes: true },
      },
    },
  });

  let deletedFiles = 0;
  let freedBytes = 0;
  const errors: { storageKey: string; error: string }[] = [];

  for (const project of candidateProjects) {
    // Tüm scheduledPost'lar published mı + en geç yayın cutoff'tan eski mi?
    const allPublished = project.scheduledPosts.every((sp) => sp.status === "published");
    if (!allPublished) continue;

    const latestPublish = project.scheduledPosts.reduce<Date | null>((acc, sp) => {
      if (!sp.publishedAt) return acc;
      const d = new Date(sp.publishedAt);
      return acc && acc > d ? acc : d;
    }, null);
    if (!latestPublish || latestPublish > cutoff) continue;

    // Bu proje uygun: tüm dosyaları temizle
    for (const file of project.files) {
      try {
        await deleteFromSupabase(file.storageKey);
        await prisma.file.update({
          where: { id: file.id },
          data: { deletedAt: new Date() },
        });
        deletedFiles++;
        freedBytes += file.sizeBytes;
      } catch (e) {
        errors.push({
          storageKey: file.storageKey,
          error: e instanceof Error ? e.message : "bilinmeyen hata",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    retentionDays: RETENTION_DAYS,
    projectsScanned: candidateProjects.length,
    deletedFiles,
    freedMB: +(freedBytes / 1024 / 1024).toFixed(1),
    errors,
  });
}

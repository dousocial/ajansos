/**
 * Toplu işlem endpoint'i — birden fazla ScheduledPost üzerinde aynı anda işlem.
 *
 * Tek tek `DELETE /api/scheduled-posts/:id` çağırmak yerine UI'dan tek istek
 * gönderilir. Status kuralları tek tek DELETE ile aynı:
 *   - pending/failed → silinebilir
 *   - publishing → atlanır (race ile yarış)
 *   - published → atlanır (platform'da zaten gitti)
 *
 * Per-id sonuç döner ki UI hangi id'lerin neden atlandığını gösterebilsin.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const BulkSchema = z.object({
  action: z.enum(["delete"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BulkSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { ids, action } = parsed.data;

  if (action === "delete") {
    // Tek query'de status'ları çek → her id için karar ver.
    const posts = await prisma.scheduledPost.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    const byId = new Map(posts.map((p) => [p.id, p.status]));

    const deletable: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const id of ids) {
      const status = byId.get(id);
      if (!status) {
        skipped.push({ id, reason: "Bulunamadı" });
        continue;
      }
      if (status === "publishing") {
        skipped.push({ id, reason: "Yayınlanıyor — bekleyin" });
        continue;
      }
      if (status === "published") {
        skipped.push({ id, reason: "Zaten yayınlandı" });
        continue;
      }
      deletable.push(id);
    }

    let deletedCount = 0;
    if (deletable.length > 0) {
      const r = await prisma.scheduledPost.deleteMany({
        where: { id: { in: deletable }, status: { in: ["pending", "failed"] } },
      });
      deletedCount = r.count;
    }

    return NextResponse.json({
      ok: true,
      requested: ids.length,
      deleted: deletedCount,
      skipped,
    });
  }

  return NextResponse.json({ error: "Bilinmeyen aksiyon" }, { status: 400 });
}

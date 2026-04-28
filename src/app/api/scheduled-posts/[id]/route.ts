/**
 * Tek bir ScheduledPost üzerinde işlem.
 *
 * DELETE /api/scheduled-posts/:id — yayını iptal eder.
 *
 * Kurallar:
 *  - Yayınlanmış (`published`) kayıt iptal edilmez. Meta tarafında zaten gitti,
 *    DB'den silmek "geçmişte yapıldığını" unutturur. Gerekirse ileride
 *    "platform üzerinden sil" akışı eklenir; şimdilik 409.
 *  - Yayınlanırken (`publishing`) kilitlenmiş bir kayıt da iptal edilmez —
 *    dispatchPublish atomik olarak claim'lemiş, ortada yarış var. 409.
 *  - `pending` / `failed` durumları iptal edilebilir → soft delete yerine
 *    hard delete: ileride bu kayıtla bağlı bir şey kalmıyor.
 *  - CLIENT rolü iptal edemez.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "id zorunlu" }, { status: 400 });
  }

  const post = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }

  if (post.status === "published") {
    return NextResponse.json(
      {
        error:
          "Yayınlanmış kayıt iptal edilemez. Platform tarafından kaldırmanız gerekir.",
      },
      { status: 409 }
    );
  }
  if (post.status === "publishing") {
    return NextResponse.json(
      {
        error:
          "Şu anda yayınlanıyor. Bitmesini bekleyin; başarısız olursa iptal edebilirsiniz.",
      },
      { status: 409 }
    );
  }

  await prisma.scheduledPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// ─── PATCH: planlı yayını düzenle ────────────────────────────────────────────
// Yalnızca pending/failed kayıtlar düzenlenebilir. publishing/published değişmez.
// retryCount sıfırlanır (yeni içerik = yeni deneme), lastError temizlenir.

const PatchSchema = z
  .object({
    caption: z.string().max(2200).optional(),
    hashtags: z.array(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "En az bir alan gerekir");

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Geçmiş tarih reddi (POST tarafıyla aynı kural; 60 sn clock-skew toleransı).
  if (parsed.data.scheduledAt) {
    const t = new Date(parsed.data.scheduledAt).getTime();
    if (t < Date.now() - 60_000) {
      return NextResponse.json(
        { error: "Geçmiş tarih seçilemez" },
        { status: 422 }
      );
    }
  }

  const post = await prisma.scheduledPost.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  if (post.status !== "pending" && post.status !== "failed") {
    return NextResponse.json(
      {
        error:
          "Sadece planlı (pending) veya hatalı (failed) yayınlar düzenlenebilir.",
      },
      { status: 409 }
    );
  }

  const updated = await prisma.scheduledPost.update({
    where: { id },
    data: {
      ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.hashtags !== undefined ? { hashtags: parsed.data.hashtags } : {}),
      ...(parsed.data.scheduledAt
        ? { scheduledAt: new Date(parsed.data.scheduledAt) }
        : {}),
      // Düzenleme = "yeni içerik" — failed retry sayacı ve hata sıfırlanır.
      // Böylece kullanıcı caption'u düzeltip "Şimdi gönder"e bastığında temiz
      // bir attempt olur.
      ...(post.status === "failed"
        ? { status: "pending", retryCount: 0, lastError: null }
        : {}),
    },
    select: { id: true, scheduledAt: true, caption: true, hashtags: true, status: true },
  });

  return NextResponse.json({ data: updated });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/social-accounts/[id]
//
// Bağlanan sosyal medya hesabını kaldırır. Cascade ile bu hesaba bağlı
// ScheduledPost kayıtları da silinir — UI tarafında SCHEDULED/QUEUED
// post varsa kullanıcı uyarılıyor (?force=true ile zorla silinir).
//
// Yetki: ADMIN ve MANAGER silebilir; CLIENT rolü silemez.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const account = await prisma.socialAccount.findUnique({
    where: { id },
    select: { id: true, clientId: true, platform: true, accountName: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Sosyal hesap bulunamadı" }, { status: 404 });
  }

  // Bekleyen yayınlar var mı? (QUEUED/SCHEDULED gibi henüz canlıya çıkmamış)
  // Eğer varsa force olmadan silmeyi reddet — kullanıcı bilinçli onay versin.
  if (!force) {
    const pendingCount = await prisma.scheduledPost.count({
      where: {
        socialAccountId: id,
        status: { in: ["pending", "scheduled", "processing", "queued"] },
      },
    });
    if (pendingCount > 0) {
      return NextResponse.json(
        {
          error: "Bu hesapta bekleyen yayınlar var",
          pendingCount,
          requiresForce: true,
        },
        { status: 409 }
      );
    }
  }

  // Hard delete — cascade ile ScheduledPost'lar da silinir.
  await prisma.socialAccount.delete({ where: { id } });

  return NextResponse.json({
    success: true,
    platform: account.platform,
    accountName: account.accountName,
  });
}

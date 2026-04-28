import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications
// Query: unread=true → sadece okunmamış; limit (default 50, max 200)
// CLIENT rolü: yalnızca kendi user.id'sine ait bildirimleri görür
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));

  const where = {
    userId: session.user.id,
    ...(unreadOnly ? { read: false } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, type: true, title: true, body: true,
        entityType: true, entityId: true, read: true, createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return NextResponse.json({ data: items, meta: { unreadCount } });
}

// PATCH /api/notifications — Tümünü okundu işaretle
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const result = await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ updated: result.count });
}

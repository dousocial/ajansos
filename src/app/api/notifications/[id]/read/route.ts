import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notifications/[id]/read — Tek bildirim okundu işaretle
export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;

  // Başka kullanıcının bildirimini işaretleyemesin
  const existing = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, read: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Bildirim bulunamadı" }, { status: 404 });
  }

  if (existing.read) {
    return NextResponse.json({ data: existing });
  }

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { read: true },
    select: { id: true, read: true },
  });

  return NextResponse.json({ data: updated });
}

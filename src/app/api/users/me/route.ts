import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateMeSchema = z.object({
  name: z.string().min(1, "Ad zorunludur").optional(),
  image: z.string().url("Geçersiz URL").optional().nullable(),
});

// GET /api/users/me — Mevcut kullanıcı profili
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id, deletedAt: null },
    select: {
      id: true, name: true, email: true, image: true, role: true,
      createdAt: true, emailVerified: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

// PATCH /api/users/me — Profil güncelleme
// Not: email değişimi kimlik doğrulama akışlarını bozabileceği için bu endpoint
// üzerinden desteklenmiyor (ayrı bir doğrulama süreci gerekir).
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = UpdateMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, image: true, role: true },
  });

  return NextResponse.json({ data: updated });
}

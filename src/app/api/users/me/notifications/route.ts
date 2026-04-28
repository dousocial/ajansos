import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NotificationType } from "@/generated/prisma/enums";

const NotificationTypeEnum = z.enum([
  "TASK_ASSIGNED",
  "FILE_UPLOADED",
  "INTERNAL_APPROVED",
  "CLIENT_APPROVED",
  "CLIENT_REVISION",
  "POST_FAILED",
  "TOKEN_EXPIRING",
  "REMINDER",
]);

const PrefSchema = z.object({
  type: NotificationTypeEnum,
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
});

const UpdateSchema = z.object({
  prefs: z.array(PrefSchema).min(1, "En az bir tercih gönderilmelidir"),
});

const ALL_TYPES = Object.values(NotificationType) as NotificationType[];

// GET /api/users/me/notifications — Tercihler (eksik olanlar default true ile)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const existing = await prisma.notificationPref.findMany({
    where: { userId: session.user.id },
  });
  const byType = new Map(existing.map((p) => [p.type, p]));

  const data = ALL_TYPES.map((type) => {
    const pref = byType.get(type);
    return {
      type,
      email: pref?.email ?? true,
      push: pref?.push ?? true,
      inApp: pref?.inApp ?? true,
    };
  });

  return NextResponse.json({ data });
}

// PATCH /api/users/me/notifications — Toplu upsert
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

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const userId = session.user.id;

  await prisma.$transaction(
    parsed.data.prefs.map((p) =>
      prisma.notificationPref.upsert({
        where: { userId_type: { userId, type: p.type } },
        create: {
          userId,
          type: p.type,
          email: p.email ?? true,
          push: p.push ?? true,
          inApp: p.inApp ?? true,
        },
        update: {
          ...(p.email !== undefined ? { email: p.email } : {}),
          ...(p.push !== undefined ? { push: p.push } : {}),
          ...(p.inApp !== undefined ? { inApp: p.inApp } : {}),
        },
      })
    )
  );

  return NextResponse.json({ success: true });
}

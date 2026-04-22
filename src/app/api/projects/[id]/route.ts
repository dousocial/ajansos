import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z
    .enum(["PLANNED", "SHOOTING", "EDITING", "INTERNAL_REVIEW", "CLIENT_REVIEW", "APPROVED", "LIVE", "PUBLISHED"])
    .optional(),
  platforms: z
    .array(z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER", "YOUTUBE"]))
    .optional(),
  postType: z.enum(["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL"]).optional(),
  shootDate: z.string().datetime().optional().nullable(),
  shootLocation: z.string().optional(),
  publishAt: z.string().datetime().optional().nullable(),
  brief: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — Tek içerik detayı
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, name: true, slug: true, logo: true, brandVoice: true, bannedWords: true, emojiPolicy: true } },
      tasks: {
        orderBy: { createdAt: "asc" },
        include: { assignedTo: { select: { id: true, name: true, image: true } } },
      },
      files: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { id: true, name: true, image: true } } },
      },
      scheduledPosts: { orderBy: { scheduledAt: "asc" } },
      aiLogs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ data: project });
}

// PATCH /api/projects/[id] — İçerik güncelle
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.project.findUnique({ where: { id, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  const { shootDate, publishAt, ...rest } = parsed.data;

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...rest,
      ...(shootDate !== undefined ? { shootDate: shootDate ? new Date(shootDate) : null } : {}),
      ...(publishAt !== undefined ? { publishAt: publishAt ? new Date(publishAt) : null } : {}),
    },
    include: {
      client: { select: { id: true, name: true, slug: true, logo: true } },
    },
  });

  // Aktivite logu
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      projectId: project.id,
      action: "project.updated",
      details: { changes: Object.keys(parsed.data) },
    },
  });

  return NextResponse.json({ data: project });
}

// DELETE /api/projects/[id] — Soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({ where: { id, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Aktivite logu
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      projectId: id,
      action: "project.deleted",
      details: { title: existing.title },
    },
  });

  return NextResponse.json({ success: true });
}

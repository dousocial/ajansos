import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ContentStatus, Platform } from "@/generated/prisma/enums";

const CreateProjectSchema = z.object({
  clientId: z.string().min(1, "Müşteri zorunludur"),
  title: z.string().min(1, "Başlık zorunludur"),
  description: z.string().optional(),
  status: z
    .enum(["PLANNED", "SHOOTING", "EDITING", "INTERNAL_REVIEW", "CLIENT_REVIEW", "APPROVED", "LIVE", "PUBLISHED"])
    .optional()
    .default("PLANNED"),
  platforms: z
    .array(z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER", "YOUTUBE"]))
    .optional()
    .default([]),
  postType: z.enum(["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL"]).optional().default("IMAGE"),
  shootDate: z.string().datetime().optional().nullable(),
  shootLocation: z.string().optional(),
  publishAt: z.string().datetime().optional().nullable(),
  brief: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
});

// GET /api/projects — İçerikleri listele
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null as null,
    ...(clientId ? { clientId } : {}),
    ...(status ? { status: status as ContentStatus } : {}),
    ...(platform ? { platforms: { has: platform as Platform } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { description: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, slug: true, logo: true } },
        _count: { select: { tasks: true, files: true, approvals: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json({
    data: projects,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/projects — Yeni içerik oluştur
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const { clientId, shootDate, publishAt, ...rest } = parsed.data;

  // Müşteri var mı kontrol et
  const client = await prisma.client.findUnique({ where: { id: clientId, deletedAt: null } });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const project = await prisma.project.create({
    data: {
      clientId,
      shootDate: shootDate ? new Date(shootDate) : null,
      publishAt: publishAt ? new Date(publishAt) : null,
      ...rest,
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
      action: "project.created",
      details: { title: project.title },
    },
  });

  return NextResponse.json({ data: project }, { status: 201 });
}

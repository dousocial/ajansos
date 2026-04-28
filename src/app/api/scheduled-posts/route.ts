import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { isPlatformSupported, SUPPORTED_PUBLISH_PLATFORMS } from "@/lib/constants";
import type { Platform } from "@/generated/prisma/enums";

// GET /api/scheduled-posts
// Query params:
//   from: ISO date (scheduledAt >= from)
//   to:   ISO date (scheduledAt <= to)
//   clientId: filter by client
//   status: filter by post status ("pending", "published", "failed", ...)
// CLIENT rolü kullanıcılar yalnızca kendi müşterisine bağlı kayıtları görebilir.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const clientIdParam = searchParams.get("clientId");
  const statusParam = searchParams.get("status");

  // Tarih aralığı (opsiyonel)
  const dateRange: Prisma.DateTimeFilter | undefined =
    fromParam || toParam
      ? {
          ...(fromParam ? { gte: new Date(fromParam) } : {}),
          ...(toParam ? { lte: new Date(toParam) } : {}),
        }
      : undefined;

  // CLIENT rol kısıtı: yalnızca kendi müşterisine ait projelerin scheduledPost'larını
  let clientFilter: Prisma.ScheduledPostWhereInput = {};
  if (session.user.role === "CLIENT") {
    if (!session.user.email) {
      return NextResponse.json({ error: "E-posta yok" }, { status: 400 });
    }
    const client = await prisma.client.findFirst({
      where: { contactEmail: session.user.email, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ data: [] });
    }
    clientFilter = { project: { clientId: client.id, deletedAt: null } };
  } else if (clientIdParam) {
    clientFilter = { project: { clientId: clientIdParam, deletedAt: null } };
  } else {
    clientFilter = { project: { deletedAt: null } };
  }

  const where: Prisma.ScheduledPostWhereInput = {
    ...clientFilter,
    ...(dateRange ? { scheduledAt: dateRange } : {}),
    ...(statusParam ? { status: statusParam } : {}),
  };

  const posts = await prisma.scheduledPost.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      platform: true,
      scheduledAt: true,
      publishedAt: true,
      status: true,
      caption: true,
      hashtags: true,
      lastError: true,
      retryCount: true,
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          postType: true,
          client: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json({ data: posts });
}

// ─── POST: Onaylı projeden yayın planla ──────────────────────────────────────
// Yayın Planlayıcı UI'sı buradan ScheduledPost oluşturur. Üretim formu
// (/icerikler/yeni) yalnızca Project yaratır; yayın config'i (platform/caption/
// scheduledAt) bu endpoint'e ait — iki süreç DB seviyesinde de net ayrık.

const PerPlatformConfig = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK", "LINKEDIN", "TWITTER", "YOUTUBE"]),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().datetime(),
});

const CreateScheduledPostsSchema = z.object({
  projectId: z.string().min(1),
  posts: z.array(PerPlatformConfig).min(1),
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
  const parsed = CreateScheduledPostsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Doğrulama hatası", details: parsed.error.flatten() },
      { status: 422 }
    );
  }
  const { projectId, posts } = parsed.data;

  // Yayınlama entegrasyonu olan platformlar
  const unsupported = posts
    .map((p) => p.platform)
    .filter((p) => !isPlatformSupported(p));
  if (unsupported.length > 0) {
    return NextResponse.json(
      {
        error: `Desteklenmeyen platform: ${unsupported.join(", ")}. Şu an: ${SUPPORTED_PUBLISH_PLATFORMS.join(", ")}.`,
      },
      { status: 422 }
    );
  }

  // Aynı platforma çift kayıt: schema zorlamıyor ama mantıken çift planlama
  // bug'ına yol açar — burada engelleyelim.
  const platformSet = new Set(posts.map((p) => p.platform));
  if (platformSet.size !== posts.length) {
    return NextResponse.json(
      { error: "Aynı platform için birden fazla post tanımlanamaz" },
      { status: 422 }
    );
  }

  // Geçmiş tarih reddi. UI'da min attr var ama dev tools / saat farkı ile
  // backend'e geçmiş tarih düşebiliyor → cron tetiklenir tetiklenmez yayınlar,
  // kullanıcı "ileri tarihli" sandığı şey anında gider. 60 sn grace clock skew için.
  const nowMs = Date.now() - 60_000;
  const pastPlatform = posts.find((p) => new Date(p.scheduledAt).getTime() < nowMs);
  if (pastPlatform) {
    return NextResponse.json(
      { error: `Geçmiş tarih seçilemez (${pastPlatform.platform}): ${pastPlatform.scheduledAt}` },
      { status: 422 }
    );
  }

  // Project yüklemesi: caption fallback'i ve mediaUrls için files lazım.
  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    include: {
      files: { where: { deletedAt: null }, select: { publicUrl: true } },
      client: { select: { id: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  // Bağlı sosyal hesapları topla
  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: project.clientId,
      platform: { in: posts.map((p) => p.platform as Platform) },
    },
    select: { id: true, platform: true },
  });
  const byPlatform = new Map<string, string>();
  for (const a of accounts) byPlatform.set(a.platform, a.id);

  const missingAccounts = posts
    .filter((p) => !byPlatform.has(p.platform))
    .map((p) => p.platform);
  if (missingAccounts.length > 0) {
    return NextResponse.json(
      {
        error: `Bağlı sosyal hesap yok: ${missingAccounts.join(", ")}. Önce müşteri profilinden hesap bağlayın.`,
      },
      { status: 422 }
    );
  }

  const mediaUrls = project.files.map((f) => f.publicUrl);
  if (mediaUrls.length === 0) {
    return NextResponse.json(
      { error: "Projede medya yok — önce üretim sayfasından dosya yükleyin" },
      { status: 422 }
    );
  }

  // Tek transaction'da yarat
  const created = await prisma.$transaction(
    posts.map((p) =>
      prisma.scheduledPost.create({
        data: {
          projectId: project.id,
          socialAccountId: byPlatform.get(p.platform)!,
          platform: p.platform as Platform,
          caption: p.caption ?? project.caption ?? null,
          hashtags: p.hashtags.length > 0 ? p.hashtags : project.hashtags,
          mediaUrls,
          scheduledAt: new Date(p.scheduledAt),
          status: "pending",
        },
        select: { id: true, platform: true, scheduledAt: true },
      })
    )
  );

  return NextResponse.json({ data: created }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ContentStatus, Platform } from "@/generated/prisma/enums";
import { isPlatformSupported, SUPPORTED_PUBLISH_PLATFORMS } from "@/lib/constants";

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
  // /yayin/hizli arkada Project yaratırken bu flag'i true verir → /icerikler
  // listesinden gizlenir. Üretim formundan gelen normal kayıtlarda false kalır.
  isQuickPublish: z.boolean().optional().default(false),
  // Yeni: form, /api/upload'dan dönen UploadResult'ları burada ekler. File DB
  // kayıtları transaction içinde projectId ile birlikte yazılır; ScheduledPost
  // oluşturulurken publicUrl'ler mediaUrls'e basılır.
  mediaFiles: z
    .array(
      z.object({
        storageKey: z.string().min(1),
        publicUrl: z.string().url(),
        name: z.string().min(1),
        mimeType: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
      })
    )
    .optional()
    .default([]),
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
  // includeQuickPublish: /yayin akışı bunu true verir (Hızlı Yayın projeleri
  // listede gerekiyor: "Yayına Hazır" filtre, picker, takvim vs).
  // /icerikler (üretim listesi) bu parametreyi vermediği için Hızlı Yayın
  // kayıtları kullanıcıdan gizlenir — onlar üretim sürecinin parçası değil.
  const includeQuickPublish = searchParams.get("includeQuickPublish") === "1";
  // NaN koruması: ?page=abc gibi query'ler Prisma skip/take'i NaN ile patlatırdı.
  const parsePositiveInt = (v: string | null, fallback: number): number => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = Math.min(100, parsePositiveInt(searchParams.get("limit"), 20));
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null as null,
    ...(includeQuickPublish ? {} : { isQuickPublish: false }),
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
        // İlk medya — /icerikler listesinde thumbnail için.
        files: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { id: true, publicUrl: true, mimeType: true },
        },
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

  const { clientId, shootDate, publishAt, mediaFiles, ...rest } = parsed.data;

  // SSRF guard: mediaFiles.publicUrl yalnızca Supabase host'undan kabul edilir.
  // Aksi halde saldırgan formdan değil doğrudan API'ye `publicUrl: "https://attacker..."`
  // gönderip Meta Graph'a kötü amaçlı içerik fetch ettirebilir.
  const supabaseHost = (() => {
    try {
      return new URL(process.env.SUPABASE_URL ?? "").host;
    } catch {
      return "";
    }
  })();
  const badMedia = mediaFiles.find((m) => {
    try {
      const u = new URL(m.publicUrl);
      return u.protocol !== "https:" || u.host !== supabaseHost;
    } catch {
      return true;
    }
  });
  if (badMedia) {
    return NextResponse.json(
      { error: "Geçersiz medya kaynağı — yalnızca Supabase URL'leri kabul edilir" },
      { status: 422 }
    );
  }

  // Yalnızca yayınlama entegrasyonu olan platformlara izin ver.
  // UI tarafında da kilit var ama doğrudan API çağrıları için ek bir güvenlik katmanı.
  const unsupported = rest.platforms.filter((p) => !isPlatformSupported(p));
  if (unsupported.length > 0) {
    return NextResponse.json(
      {
        error: `Şu platformlar henüz desteklenmiyor: ${unsupported.join(", ")}. Şu an desteklenenler: ${SUPPORTED_PUBLISH_PLATFORMS.join(", ")}.`,
      },
      { status: 422 }
    );
  }

  // Müşteri var mı kontrol et
  const client = await prisma.client.findUnique({ where: { id: clientId, deletedAt: null } });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  // Session user hala DB'de var mı? (DB reset veya user silinmesi sonrası JWT stale
  // kalabilir — bu durumda ActivityLog FK'si patlar. Erken 401 ile kullanıcıyı
  // yeniden giriş yapmaya yönlendir, 500 yerine.)
  const sessionUser = await prisma.user.findUnique({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!sessionUser) {
    return NextResponse.json(
      { error: "Oturumunuz güncel değil. Lütfen çıkış yapıp tekrar giriş yapın." },
      { status: 401 }
    );
  }

  const publishAtDate = publishAt ? new Date(publishAt) : null;

  // publishAt geçmişte ise ScheduledPost yaratıldığı an cron tetikler — bunu
  // kullanıcı "ileri tarih" sandığı için tehlikeli. Sadece ScheduledPost
  // oluşturulacak akışta bloklayalım (publishAt + platforms birlikte var).
  if (publishAtDate && rest.platforms.length > 0) {
    if (publishAtDate.getTime() < Date.now() - 60_000) {
      return NextResponse.json(
        { error: "Geçmiş tarih seçilemez" },
        { status: 422 }
      );
    }
  }

  // Proje + ScheduledPost'lar + ActivityLog tek transaction'da yazılsın — ActivityLog
  // FK patlarsa önceki yazımlar da geri alınsın, orphan proje bırakma.
  // Transaction timeout: default 5sn; 7 platform + büyük ActivityLog details ile
  // sınırı aşabiliyor. 15sn yeterli; bu süreyi aşan akışı zaten async işlemeliyiz.
  const { project, scheduledResult } = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        clientId,
        shootDate: shootDate ? new Date(shootDate) : null,
        publishAt: publishAtDate,
        ...rest,
      },
      include: {
        client: { select: { id: true, name: true, slug: true, logo: true } },
      },
    });

    // Yüklenen medyaları File tablosuna projectId ile bağla. /api/upload sadece
    // Storage'a koymuştu; DB kaydı burada açılıyor (project.id şimdi var).
    const mediaUrls: string[] = [];
    if (mediaFiles.length > 0) {
      await tx.file.createMany({
        data: mediaFiles.map((f) => ({
          projectId: project.id,
          name: f.name,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          storageKey: f.storageKey,
          publicUrl: f.publicUrl,
        })),
      });
      mediaUrls.push(...mediaFiles.map((f) => f.publicUrl));
    }

    // publishAt + platform varsa: bağlı sosyal hesaplar için ScheduledPost oluştur
    const scheduledResult: {
      created: { platform: Platform; scheduledPostId: string }[];
      missingAccounts: Platform[];
    } = { created: [], missingAccounts: [] };

    if (publishAtDate && rest.platforms.length > 0) {
      const accounts = await tx.socialAccount.findMany({
        where: { clientId, platform: { in: rest.platforms } },
        select: { id: true, platform: true },
      });
      const byPlatform = new Map<Platform, string>();
      for (const a of accounts) byPlatform.set(a.platform, a.id);

      for (const platform of rest.platforms) {
        const socialAccountId = byPlatform.get(platform);
        if (!socialAccountId) {
          scheduledResult.missingAccounts.push(platform);
          continue;
        }
        const sp = await tx.scheduledPost.create({
          data: {
            projectId: project.id,
            socialAccountId,
            platform,
            caption: rest.caption ?? null,
            hashtags: rest.hashtags ?? [],
            mediaUrls,
            scheduledAt: publishAtDate,
            status: "pending",
          },
        });
        scheduledResult.created.push({ platform, scheduledPostId: sp.id });
      }
    }

    // Aktivite logu
    await tx.activityLog.create({
      data: {
        userId: sessionUser.id,
        projectId: project.id,
        action: "project.created",
        details: {
          title: project.title,
          scheduled: scheduledResult.created.length,
          missingAccounts: scheduledResult.missingAccounts,
        },
      },
    });

    return { project, scheduledResult };
  }, { timeout: 15000 });

  return NextResponse.json(
    { data: project, scheduled: scheduledResult },
    { status: 201 }
  );
}

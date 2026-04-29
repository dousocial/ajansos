import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadToSupabase } from "@/lib/storage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/projects/[id]/files
 *
 * Mevcut bir projeye dosya yükler:
 *  1. Supabase Storage'a kaydeder
 *  2. File DB satırı açar (projectId ile bağlı)
 *  3. Project.lastActorId'yi günceller
 *
 * /api/upload tek başına Storage'a yazıp publicUrl döner; bu endpoint o adımı +
 * DB kaydı yaratımını birleştirir, yayın akışında "medya yok" engelini aşar.
 *
 * Yetki: ADMIN/TEAM. CLIENT erişemez.
 */

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "image/png";
  if (buf.toString("ascii", 0, 6).startsWith("GIF8")) return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId, deletedAt: null },
    select: { id: true, clientId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file alanı zorunlu" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Boş dosya" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Desteklenmeyen tip: ${file.type}` },
      { status: 415 }
    );
  }

  const isVideo = file.type.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Dosya çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Limit: ${(
          maxBytes /
          1024 /
          1024
        ).toFixed(0)} MB`,
      },
      { status: 413 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı" }, { status: 400 });
  }

  const sniffed = sniffMime(buffer);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Dosya içeriği desteklenmeyen formatta" },
      { status: 415 }
    );
  }
  const headerCat = file.type.split("/")[0];
  const sniffCat = sniffed.split("/")[0];
  if (headerCat !== sniffCat) {
    return NextResponse.json(
      { error: `Dosya içeriği header ile uyuşmuyor (${file.type} vs ${sniffed})` },
      { status: 415 }
    );
  }

  try {
    const uploaded = await uploadToSupabase({
      clientId: project.clientId,
      fileName: file.name,
      mimeType: file.type,
      body: buffer,
      sizeBytes: file.size,
    });

    const fileRow = await prisma.file.create({
      data: {
        projectId: project.id,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey: uploaded.storageKey,
        publicUrl: uploaded.publicUrl,
      },
      select: {
        id: true,
        name: true,
        publicUrl: true,
        mimeType: true,
        sizeBytes: true,
      },
    });

    // Son müdahale eden — Süreç Yönetimi'ndeki "Son" sütunu için
    await prisma.project.update({
      where: { id: project.id },
      data: { lastActorId: session.user.id ?? null },
    });

    // Aktivite logu
    await prisma.activityLog
      .create({
        data: {
          userId: session.user.id ?? null,
          projectId: project.id,
          action: "file.uploaded",
          details: { fileId: fileRow.id, name: fileRow.name, size: fileRow.sizeBytes },
        },
      })
      .catch(() => {});

    return NextResponse.json({ data: fileRow }, { status: 201 });
  } catch (e) {
    logger.error("project.files.upload_failed", { projectId, err: e });
    const msg = e instanceof Error ? e.message : "Yükleme hatası";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

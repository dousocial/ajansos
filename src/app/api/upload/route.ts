/**
 * /api/upload — Supabase Storage'a dosya yükler / siler.
 *
 * POST: multipart `{ file, clientId }` → `publicUrl` döner. DB kaydı yazmaz;
 * File satırı /api/projects POST içinde projectId belli olunca açılır.
 *
 * DELETE: query `?key=<storageKey>` → bucket'tan siler. Yalnız henüz herhangi
 * bir File DB kaydına bağlanmamış orphan objeler için (kullanıcı `removeMedia`
 * UI'dan kaldırırsa bu yol). DB'de bağlı dosya silme işi /api/projects DELETE'e
 * aittir.
 *
 * Güvenlik:
 *  • Session zorunlu; CLIENT rolü reddedilir.
 *  • clientId DB'de var olmalı (yetkisiz path'e yazımı engeller).
 *  • MIME hem header hem magic byte ile doğrulanır (polyglot/spoof koruması).
 *  • file.size 0 → 400 (Meta'da garip "Invalid parameter"a düşmesin).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadToSupabase, deleteFromSupabase } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

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

/**
 * Magic byte sniff — `Content-Type` header'ı tarayıcıdan geldiği için güvensiz.
 * Polyglot dosya (jpg uzantı + içerik HTML) public bucket'ta XSS vektörü olur.
 * Sadece desteklediğimiz formatları kontrol ediyoruz; sniff başarısızsa reddet.
 */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
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
  // GIF: "GIF87a" veya "GIF89a"
  if (buf.toString("ascii", 0, 6).startsWith("GIF8")) return "image/gif";
  // WEBP: "RIFF" .... "WEBP"
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  // MP4 / QuickTime: ftyp box, offset 4
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "qt  ") return "video/quicktime";
    // mp4/iso/avc/mmp4/M4V vs. — hepsini mp4 sayalım
    return "video/mp4";
  }
  return null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz form-data" }, { status: 400 });
  }

  const file = form.get("file");
  const clientIdRaw = form.get("clientId");
  const clientId = typeof clientIdRaw === "string" ? clientIdRaw.trim() : "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file alanı zorunlu" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "clientId zorunlu" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Boş dosya yüklenemez" }, { status: 400 });
  }

  // AuthZ: clientId DB'de var mı? Aksi halde başkasının clientId'sine path
  // yazılabilir — orphan storage çöpü ve potansiyel müşteri verisi karışması.
  const client = await prisma.client.findUnique({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: `Desteklenmeyen dosya tipi: ${file.type}. İzin verilenler: ${Array.from(
          ALLOWED_MIME
        ).join(", ")}`,
      },
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
  } catch (e) {
    console.error("[/api/upload] body read failed:", e);
    return NextResponse.json({ error: "Dosya okunamadı" }, { status: 400 });
  }

  // Magic byte doğrulaması — header'la uyuşmuyorsa polyglot/spoof.
  const sniffed = sniffMime(buffer);
  if (!sniffed) {
    return NextResponse.json(
      { error: "Dosya içeriği desteklenen bir formatta değil" },
      { status: 415 }
    );
  }
  // jpeg ↔ jpg gibi alias için tam eşitlik şart değil; ana kategori uyuşsun:
  const headerCat = file.type.split("/")[0];
  const sniffCat = sniffed.split("/")[0];
  if (headerCat !== sniffCat) {
    return NextResponse.json(
      {
        error: `Dosya içeriği header ile uyuşmuyor (header=${file.type}, gerçek=${sniffed})`,
      },
      { status: 415 }
    );
  }

  try {
    const result = await uploadToSupabase({
      clientId,
      fileName: file.name,
      mimeType: file.type,
      body: buffer,
      sizeBytes: file.size,
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen yükleme hatası";
    console.error("[/api/upload] failed:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/upload?key=<storageKey>
 * Yalnız henüz File DB kaydı oluşturulmamış (orphan) objeyi siler.
 * Bağlı File varsa 409 — proje DELETE akışından gitmesi gerekir.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key zorunlu" }, { status: 400 });
  }

  const existing = await prisma.file.findFirst({
    where: { storageKey: key },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Bu dosya bir projeye bağlı; proje üzerinden silinmeli" },
      { status: 409 }
    );
  }

  try {
    await deleteFromSupabase(key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Silme hatası";
    console.error("[/api/upload DELETE] failed:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadToSupabase } from "@/lib/storage";

// GET /api/clients/[id]/documents — Müşterinin döküman listesi (sözleşme/fatura/diğer).
// PDF upload + listele için /odemeler kart sayfası ve müşteri kartı kullanır.
type Params = { params: Promise<{ id: string }> };

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_KINDS = ["CONTRACT", "INVOICE_DOC", "OTHER"] as const;
type DocKind = (typeof ALLOWED_KINDS)[number];

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const invoiceId = searchParams.get("invoiceId");

  const docs = await prisma.clientDocument.findMany({
    where: {
      clientId: id,
      deletedAt: null,
      ...(kind && (ALLOWED_KINDS as readonly string[]).includes(kind)
        ? { kind: kind as DocKind }
        : {}),
      ...(invoiceId ? { invoiceId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: docs });
}

// POST /api/clients/[id]/documents — multipart upload
// FormData fields: file (Blob), kind (CONTRACT|INVOICE_DOC|OTHER), label?, invoiceId?
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;

  // Müşteri var mı?
  const client = await prisma.client.findUnique({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData parse edilemedi" }, { status: 400 });
  }

  const file = formData.get("file");
  const kindRaw = (formData.get("kind") as string | null) ?? "OTHER";
  const label = (formData.get("label") as string | null) ?? null;
  const invoiceId = (formData.get("invoiceId") as string | null) ?? null;

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Dosya yok" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya çok büyük (max 25 MB)" }, { status: 413 });
  }
  if (!(ALLOWED_KINDS as readonly string[]).includes(kindRaw)) {
    return NextResponse.json({ error: "Geçersiz döküman türü" }, { status: 422 });
  }
  const kind = kindRaw as DocKind;

  // PDF dışındakileri de kabul ediyoruz (sözleşme jpg/png olabilir) ama
  // mimeType'ı normalize et.
  const mimeType = file.type || "application/octet-stream";
  const fileName = (file as File).name || "document";

  // invoiceId verildiyse aynı müşteriye ait olmalı.
  if (invoiceId) {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId, deletedAt: null },
      select: { clientId: true },
    });
    if (!inv || inv.clientId !== id) {
      return NextResponse.json(
        { error: "Fatura bu müşteriye ait değil" },
        { status: 422 }
      );
    }
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToSupabase({
      clientId: id,
      fileName,
      mimeType,
      body: buffer,
      sizeBytes: file.size,
      pathPrefix: "documents",
    });

    const doc = await prisma.clientDocument.create({
      data: {
        clientId: id,
        kind,
        name: fileName,
        label: label || null,
        mimeType,
        sizeBytes: file.size,
        storageKey: uploaded.storageKey,
        publicUrl: uploaded.publicUrl,
        invoiceId: invoiceId || null,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("[api/clients/.../documents POST] hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

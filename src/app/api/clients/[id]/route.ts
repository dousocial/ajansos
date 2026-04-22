import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Geçersiz e-posta").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  brandVoice: z.string().optional(),
  bannedWords: z.array(z.string()).optional(),
  emojiPolicy: z.boolean().optional(),
  revisionQuota: z.number().int().min(0).optional(),
  healthScore: z.number().int().min(0).max(100).optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/clients/[id] — Tek müşteri detayı
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id, deletedAt: null },
    include: {
      socialAccounts: true,
      teamAssignments: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } },
      projects: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, status: true, platforms: true, postType: true, publishAt: true, createdAt: true },
      },
      _count: { select: { projects: true } },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ data: client });
}

// PATCH /api/clients/[id] — Müşteri güncelle
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

  const parsed = UpdateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.client.findUnique({ where: { id, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const { contactEmail, ...rest } = parsed.data;

  const client = await prisma.client.update({
    where: { id },
    data: {
      ...rest,
      ...(contactEmail !== undefined ? { contactEmail: contactEmail || null } : {}),
    },
  });

  return NextResponse.json({ data: client });
}

// DELETE /api/clients/[id] — Soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sadece adminler müşteri silebilir" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.client.findUnique({ where: { id, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  await prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

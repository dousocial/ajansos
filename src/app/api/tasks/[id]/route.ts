import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  completed: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/tasks/[id] — Tek görev detayı
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, client: { select: { id: true, name: true, slug: true } } } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ data: task });
}

// PATCH /api/tasks/[id] — Görev güncelle (tamamlama dahil)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  }

  const { completed, dueDate, assignedToId, ...rest } = parsed.data;

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
      // Tamamlandı/tamamlanmadı toggle
      ...(completed === true && !existing.completedAt ? { completedAt: new Date() } : {}),
      ...(completed === false && existing.completedAt ? { completedAt: null } : {}),
    },
    include: {
      project: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({ data: task });
}

// DELETE /api/tasks/[id] — Görevi sil (hard delete, görevlerin audit kaydı önemli değil)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Görev bulunamadı" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

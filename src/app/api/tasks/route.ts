import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateTaskSchema = z.object({
  projectId: z.string().min(1, "Proje zorunludur"),
  title: z.string().min(1, "Başlık zorunludur"),
  description: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
});

// GET /api/tasks — Görevleri listele
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const assignedToId = searchParams.get("assignedToId");
  const completed = searchParams.get("completed");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const skip = (page - 1) * limit;

  const where = {
    ...(projectId ? { projectId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(completed === "true" ? { completedAt: { not: null as null } } : {}),
    ...(completed === "false" ? { completedAt: null as null } : {}),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      include: {
        project: { select: { id: true, title: true, client: { select: { id: true, name: true, slug: true } } } },
        assignedTo: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return NextResponse.json({
    data: tasks,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/tasks — Yeni görev oluştur
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

  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const { projectId, dueDate, assignedToId, ...rest } = parsed.data;

  // Proje var mı?
  const project = await prisma.project.findUnique({ where: { id: projectId, deletedAt: null } });
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: assignedToId || null,
      ...rest,
    },
    include: {
      project: { select: { id: true, title: true, client: { select: { id: true, name: true } } } },
      assignedTo: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({ data: task }, { status: 201 });
}

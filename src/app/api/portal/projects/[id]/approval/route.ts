import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION"]),
  note: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

// POST /api/portal/projects/[id]/approval
// CLIENT kullanıcı bir projeyi onaylar veya revizyon ister
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Bu işlem yalnızca müşteri kullanıcılarına açıktır" }, { status: 403 });
  }
  if (!session.user.email) {
    return NextResponse.json({ error: "E-posta yok" }, { status: 400 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }
  const parsed = ApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  // Projeyi client üzerinden doğrula (başka müşterinin projesine yazamasın)
  const project = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
      client: { contactEmail: session.user.email, deletedAt: null },
    },
    select: { id: true, status: true, clientId: true, title: true },
  });

  if (!project) {
    return NextResponse.json({ error: "İçerik bulunamadı" }, { status: 404 });
  }

  // Yalnızca CLIENT_REVIEW durumundaki projeler onaylanabilir
  if (project.status !== "CLIENT_REVIEW") {
    return NextResponse.json(
      { error: "Bu içerik şu an onaylanabilir durumda değil" },
      { status: 409 }
    );
  }

  const { decision, note } = parsed.data;

  const nextStatus = decision === "APPROVED" ? "APPROVED" : "EDITING";
  const approvalStatus = decision === "APPROVED" ? "APPROVED" : "REVISION_REQUESTED";

  const [updatedProject, approval] = await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: { status: nextStatus },
    }),
    prisma.approval.create({
      data: {
        projectId: project.id,
        reviewerId: session.user.id ?? null,
        type: "CLIENT",
        status: approvalStatus,
        note: note ?? null,
      },
    }),
  ]);

  await prisma.activityLog.create({
    data: {
      userId: session.user.id ?? null,
      projectId: project.id,
      action: decision === "APPROVED" ? "project.client_approved" : "project.client_revision_requested",
      details: { title: project.title, note: note ?? null },
    },
  });

  return NextResponse.json({
    data: { project: updatedProject, approval },
  });
}

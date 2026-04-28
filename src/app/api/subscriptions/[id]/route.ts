import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional(),
  endDate: z.string().nullable().optional(),
  nextInvoiceDate: z.string().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const subscription = await prisma.subscription.findUnique({
    where: { id, deletedAt: null },
    include: {
      client: true,
      invoices: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          currency: true,
          status: true,
          issueDate: true,
          dueDate: true,
          paidAt: true,
        },
      },
    },
  });
  if (!subscription) return NextResponse.json({ error: "Abonelik bulunamadı" }, { status: 404 });

  return NextResponse.json({ data: subscription });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.subscription.findUnique({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Abonelik bulunamadı" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = UpdateSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
  if (parsed.data.vatRate !== undefined) patch.vatRate = parsed.data.vatRate;
  if (parsed.data.interval !== undefined) patch.interval = parsed.data.interval;
  if (parsed.data.endDate !== undefined) patch.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  if (parsed.data.nextInvoiceDate !== undefined) patch.nextInvoiceDate = new Date(parsed.data.nextInvoiceDate);
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;

  const updated = await prisma.subscription.update({
    where: { id },
    data: patch,
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  await prisma.subscription.update({
    where: { id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });
  return NextResponse.json({ ok: true });
}

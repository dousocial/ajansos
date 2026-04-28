import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { computeAmounts } from "@/lib/invoices/compute";

type Params = { params: Promise<{ id: string }> };

const UpdateInvoiceSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  paymentMethod: z.string().nullable().optional(),
  publicNote: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
});

// GET /api/invoices/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id, deletedAt: null },
    include: {
      client: true,
      subscription: { select: { id: true, name: true, interval: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });

  return NextResponse.json({ data: invoice });
}

// PATCH /api/invoices/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = UpdateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  // PAID olduktan sonra içerik değişimini kilitle — sadece status değiştirilebilir
  if (existing.status === "PAID" && (parsed.data.amount || parsed.data.vatRate || parsed.data.title)) {
    return NextResponse.json(
      { error: "Ödenmiş fatura içerik olarak düzenlenemez" },
      { status: 409 }
    );
  }

  // Tutar değiştiyse yeniden hesapla
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.paymentMethod !== undefined) patch.paymentMethod = parsed.data.paymentMethod;
  if (parsed.data.publicNote !== undefined) patch.publicNote = parsed.data.publicNote;
  if (parsed.data.dueDate !== undefined) patch.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === "PAID" && !existing.paidAt) patch.paidAt = new Date();
    if (parsed.data.status === "SENT" && !existing.sentAt) patch.sentAt = new Date();
  }

  if (parsed.data.amount !== undefined || parsed.data.vatRate !== undefined) {
    const amount = parsed.data.amount ?? Number(existing.amount);
    const vatRate = parsed.data.vatRate ?? Number(existing.vatRate);
    const amounts = computeAmounts(amount, vatRate);
    patch.amount = amounts.amount;
    patch.vatRate = amounts.vatRate;
    patch.vatAmount = amounts.vatAmount;
    patch.totalAmount = amounts.totalAmount;
    // Tutar değiştiyse cache'lenmiş PDF geçersiz
    patch.pdfUrl = null;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: patch,
    include: { client: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: updated });
}

// DELETE /api/invoices/[id] — Soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });
  if (existing.status === "PAID") {
    return NextResponse.json({ error: "Ödenmiş fatura silinemez" }, { status: 409 });
  }

  await prisma.invoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

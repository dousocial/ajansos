import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  paymentMethod: z.string().optional().default("havale"),
  paymentNote: z.string().optional(),
  paidAt: z.string().optional(), // ISO — yoksa now
});

// POST /api/invoices/[id]/mark-paid — Manuel olarak ödendi olarak işaretle
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.invoice.findUnique({
    where: { id, deletedAt: null },
    include: { client: { select: { id: true, name: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Fatura bulunamadı" }, { status: 404 });
  if (existing.status === "PAID") {
    return NextResponse.json({ error: "Fatura zaten ödenmiş", data: existing }, { status: 409 });
  }
  if (existing.status === "CANCELLED") {
    return NextResponse.json({ error: "İptal edilmiş fatura ödenmiş olarak işaretlenemez" }, { status: 409 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // body opsiyonel
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : new Date();

  const [updated] = await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt,
        paymentMethod: parsed.data.paymentMethod,
        paymentNote: parsed.data.paymentNote,
      },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.notification.create({
      data: {
        clientId: existing.clientId,
        type: "INVOICE_PAID",
        title: `Ödeme alındı: ${existing.invoiceNumber}`,
        body: `${existing.client.name} müşterisinden ${existing.invoiceNumber} nolu fatura için ödeme kaydedildi.`,
        entityType: "Invoice",
        entityId: existing.id,
      },
    }),
    prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "INVOICE_PAID",
        details: {
          invoiceId: existing.id,
          invoiceNumber: existing.invoiceNumber,
          paidAt: paidAt.toISOString(),
          paymentMethod: parsed.data.paymentMethod,
        },
      },
    }),
  ]);

  return NextResponse.json({ data: updated });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { computeAmounts } from "@/lib/invoices/compute";
import { nextInvoiceNumber } from "@/lib/invoices/numbering";
import { advanceInvoiceDate, defaultDueDate } from "@/lib/invoices/schedule";

const CreateInvoiceSchema = z.object({
  clientId: z.string().min(1, "Müşteri seçilmeli"),
  subscriptionId: z.string().optional().nullable(),
  title: z.string().min(1, "Başlık zorunlu"),
  description: z.string().optional(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional().default("TRY"),
  amount: z.number().positive("Tutar 0'dan büyük olmalı"),
  vatRate: z.number().min(0).max(100).optional().default(20),
  issueDate: z.string().optional(), // ISO
  dueDate: z.string().optional(), // ISO — yoksa +14 gün
  paymentMethod: z.string().optional(),
  publicNote: z.string().optional(),
});

// GET /api/invoices — Admin/Team için fatura listesi (filtreli)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    ...(status ? { status: status as "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED" } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            { title: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, slug: true, logo: true } },
        subscription: { select: { id: true, name: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    data: invoices,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/invoices — Yeni fatura oluştur (DRAFT)
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

  const parsed = CreateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  // Müşteri var mı?
  const client = await prisma.client.findUnique({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const amounts = computeAmounts(input.amount, input.vatRate);
  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const dueDate = input.dueDate ? new Date(input.dueDate) : defaultDueDate(issueDate);

  // Subscription doğrulama: subscriptionId verildiyse müşteriyle eşleşmeli ve
  // ileride nextInvoiceDate'i atomik olarak ileri alacağız.
  let subscriptionForBump:
    | { id: string; interval: "MONTHLY" | "QUARTERLY" | "YEARLY"; nextInvoiceDate: Date }
    | null = null;
  if (input.subscriptionId) {
    const sub = await prisma.subscription.findUnique({
      where: { id: input.subscriptionId, deletedAt: null },
      select: { id: true, clientId: true, interval: true, nextInvoiceDate: true, status: true },
    });
    if (!sub || sub.clientId !== input.clientId) {
      return NextResponse.json(
        { error: "Abonelik bu müşteriye ait değil" },
        { status: 422 }
      );
    }
    if (sub.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Sadece aktif aboneliklere fatura kesilebilir" },
        { status: 422 }
      );
    }
    subscriptionForBump = sub;
  }

  // Atomic flow: Invoice create + (varsa) Subscription.nextInvoiceDate ileri al.
  // Önceden ayrık çağrılardı; create başarılı olup nextInvoiceDate update fail
  // ederse cron aynı dönem için tekrar fatura keserdi. Tek transaction'da yap.
  async function createWithRetry(num: string) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          clientId: input.clientId,
          subscriptionId: input.subscriptionId || null,
          invoiceNumber: num,
          title: input.title,
          description: input.description,
          currency: input.currency,
          amount: amounts.amount,
          vatRate: amounts.vatRate,
          vatAmount: amounts.vatAmount,
          totalAmount: amounts.totalAmount,
          issueDate,
          dueDate,
          paymentMethod: input.paymentMethod,
          publicNote: input.publicNote,
        },
        include: { client: { select: { id: true, name: true } } },
      });
      if (subscriptionForBump) {
        await tx.subscription.update({
          where: { id: subscriptionForBump.id },
          data: {
            nextInvoiceDate: advanceInvoiceDate(
              subscriptionForBump.nextInvoiceDate,
              subscriptionForBump.interval
            ),
          },
        });
      }
      return inv;
    });
  }

  let invoiceNumber = await nextInvoiceNumber(issueDate);
  try {
    const invoice = await createWithRetry(invoiceNumber);
    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Unique violation (invoiceNumber çakışması) — yeni numara alıp 1 kez dene.
    if (msg.includes("Unique") || msg.includes("invoiceNumber")) {
      invoiceNumber = await nextInvoiceNumber(issueDate);
      try {
        const invoice = await createWithRetry(invoiceNumber);
        return NextResponse.json({ data: invoice }, { status: 201 });
      } catch (e2) {
        console.error("[api/invoices POST] retry hata:", e2);
        return NextResponse.json({ error: "Fatura oluşturulamadı" }, { status: 500 });
      }
    }
    console.error("[api/invoices POST] hata:", msg);
    return NextResponse.json({ error: "Fatura oluşturulamadı" }, { status: 500 });
  }
}

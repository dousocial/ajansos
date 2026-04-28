import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSubscriptionSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  amount: z.number().positive(),
  currency: z.enum(["TRY", "USD", "EUR"]).optional().default("TRY"),
  vatRate: z.number().min(0).max(100).optional().default(20),
  interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).optional().default("MONTHLY"),
  startDate: z.string(), // ISO, zorunlu
  endDate: z.string().optional(),
  nextInvoiceDate: z.string().optional(), // yoksa startDate
  notes: z.string().optional(),
});

// GET /api/subscriptions
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    ...(status ? { status: status as "ACTIVE" | "PAUSED" | "CANCELLED" } : {}),
  };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, slug: true, logo: true } },
        _count: { select: { invoices: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return NextResponse.json({
    data: subscriptions,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/subscriptions
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  if (session.user.role === "CLIENT") return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = CreateSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  const client = await prisma.client.findUnique({
    where: { id: input.clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });

  const startDate = new Date(input.startDate);
  const endDate = input.endDate ? new Date(input.endDate) : null;
  const nextInvoiceDate = input.nextInvoiceDate ? new Date(input.nextInvoiceDate) : startDate;

  const subscription = await prisma.subscription.create({
    data: {
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      vatRate: input.vatRate,
      interval: input.interval,
      startDate,
      endDate,
      nextInvoiceDate,
      notes: input.notes,
    },
    include: { client: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: subscription }, { status: 201 });
}

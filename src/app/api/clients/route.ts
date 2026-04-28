import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { slugify } from "@/lib/utils";

const CreateClientSchema = z.object({
  name: z.string().min(1, "İsim zorunludur"),
  industry: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Geçersiz e-posta").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  brandVoice: z.string().optional(),
  bannedWords: z.array(z.string()).optional().default([]),
  emojiPolicy: z.boolean().optional().default(true),
  revisionQuota: z.number().int().min(0).optional().default(3),
});

// GET /api/clients — Tüm müşterileri listele
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { contactName: { contains: search, mode: "insensitive" as const } },
            { contactEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        socialAccounts: { select: { platform: true } },
        _count: { select: { projects: true, teamAssignments: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    data: clients,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/clients — Yeni müşteri oluştur
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

  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Doğrulama hatası", details: parsed.error.flatten() }, { status: 422 });
  }

  const { name, contactEmail, ...rest } = parsed.data;

  // Slug oluştur, tekrar eden slug varsa sayı ekle
  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.client.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }

  const client = await prisma.client.create({
    data: {
      name,
      slug,
      contactEmail: contactEmail || null,
      ...rest,
    },
  });

  return NextResponse.json({ data: client }, { status: 201 });
}

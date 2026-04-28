/**
 * GET /api/activity — sayfalı, filtreli aktivite log akışı.
 *
 * CLIENT rolü erişemez (iç süreç). ADMIN/TEAM hepsini görebilir.
 *
 * Query:
 *   ?projectId=...   tek proje
 *   ?userId=...      tek kullanıcı
 *   ?action=...      action prefix (örn. "project." veya "publish.")
 *   ?page=1&limit=50
 *
 * Cevap:
 *   { data: [...], meta: { total, page, limit, totalPages } }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");

  const parsePositiveInt = (v: string | null, fb: number) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : fb;
  };
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const limit = Math.min(200, parsePositiveInt(searchParams.get("limit"), 50));
  const skip = (page - 1) * limit;

  const where = {
    ...(projectId ? { projectId } : {}),
    ...(userId ? { userId } : {}),
    ...(action ? { action: { startsWith: action } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        project: { select: { id: true, title: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

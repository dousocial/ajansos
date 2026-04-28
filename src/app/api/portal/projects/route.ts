import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPortalToken } from "@/lib/portal-token";

// GET /api/portal/projects — İki mod:
//   (1) CLIENT rolünde giriş yapmış kullanıcı: kendi müşterisine ait projeler
//   (2) ?preview=<jwt> query + ADMIN/TEAM oturumu: JWT'teki clientId için salt-okunur
//       önizleme (aksiyon endpoint'leri hâlâ CLIENT rolü ister)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const previewToken = searchParams.get("preview");

  let clientId: string | null = null;
  let mode: "client" | "preview" = "client";

  if (previewToken) {
    // ADMIN/TEAM preview akışı — CLIENT rolü buraya giremez (kendi verisini görür zaten)
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "CLIENT kullanıcı için preview kullanılmaz" }, { status: 400 });
    }
    const verified = await verifyPortalToken(previewToken);
    if (!verified) {
      return NextResponse.json({ error: "Geçersiz veya süresi geçmiş önizleme linki" }, { status: 401 });
    }
    clientId = verified.clientId;
    mode = "preview";
  } else {
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "Portal yalnızca müşteri kullanıcılara açıktır" }, { status: 403 });
    }
    if (!session.user.email) {
      return NextResponse.json({ error: "E-posta yok" }, { status: 400 });
    }
    const me = await prisma.client.findFirst({
      where: { contactEmail: session.user.email, deletedAt: null },
      select: { id: true },
    });
    if (!me) {
      return NextResponse.json({
        client: null,
        projects: [],
        error: "Hesabınıza bağlı müşteri bulunamadı.",
        mode: "client",
      });
    }
    clientId = me.id;
  }

  if (!clientId) {
    return NextResponse.json({ error: "Müşteri çözümlenemedi" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const projects = await prisma.project.findMany({
    where: { clientId: client.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      platforms: true,
      postType: true,
      caption: true,
      publishAt: true,
      updatedAt: true,
      approvals: {
        where: { type: "CLIENT" },
        select: { id: true },
      },
    },
  });

  const data = projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    platforms: p.platforms,
    postType: p.postType,
    caption: p.caption,
    publishAt: p.publishAt,
    updatedAt: p.updatedAt,
    revisions: p.approvals.length,
  }));

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    projects: data,
    mode,
  });
}

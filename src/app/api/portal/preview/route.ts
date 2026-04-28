import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signPortalToken } from "@/lib/portal-token";

// GET /api/portal/preview?clientId=xxx
// ADMIN/TEAM kullanıcıların bir müşterinin portalını önizlemek için imzalı JWT ile
// /portal?preview=<token> adresine yönlendirilmesini sağlar. Token 24 saat geçerlidir.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json(
      { error: "CLIENT kullanıcı için önizleme anlamlı değil" },
      { status: 403 }
    );
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId gereklidir" }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId, deletedAt: null },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  const token = await signPortalToken(client.id, session.user.id);

  // ActivityLog ile kaydet — hangi admin hangi müşteriyi önizledi
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: "portal.preview_created",
      details: { clientId: client.id },
    },
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin ?? "http://localhost:3000";
  const redirectTo = new URL("/portal", appUrl);
  redirectTo.searchParams.set("preview", token);

  return NextResponse.redirect(redirectTo.toString());
}

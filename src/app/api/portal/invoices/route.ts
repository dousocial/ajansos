import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyPortalToken } from "@/lib/portal-token";

/**
 * GET /api/portal/invoices — Müşterinin kendi faturaları.
 *
 * İki mod:
 *  (1) CLIENT rolünde oturum açmış → contactEmail eşleşen client'ın faturaları
 *  (2) ?preview=<jwt> + ADMIN/TEAM → önizleme (müşteri gibi görür)
 *
 * DRAFT faturalar listeden gizlenir — müşteriye ancak SENT olunca görünür olur.
 */
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
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "CLIENT için preview kullanılmaz" }, { status: 400 });
    }
    const verified = await verifyPortalToken(previewToken);
    if (!verified) {
      return NextResponse.json({ error: "Geçersiz veya süresi geçmiş önizleme linki" }, { status: 401 });
    }
    clientId = verified.clientId;
    mode = "preview";
  } else {
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "Portal yalnızca müşterilere açıktır" }, { status: 403 });
    }
    if (!session.user.email) {
      return NextResponse.json({ error: "E-posta yok" }, { status: 400 });
    }
    const me = await prisma.client.findFirst({
      where: { contactEmail: session.user.email, deletedAt: null },
      select: { id: true },
    });
    if (!me) {
      return NextResponse.json({ client: null, invoices: [], mode: "client" });
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

  const invoices = await prisma.invoice.findMany({
    where: {
      clientId: client.id,
      deletedAt: null,
      // DRAFT müşteriye gösterilmez
      status: { in: ["SENT", "PAID", "OVERDUE"] },
    },
    orderBy: { issueDate: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      title: true,
      currency: true,
      amount: true,
      vatRate: true,
      vatAmount: true,
      totalAmount: true,
      status: true,
      issueDate: true,
      dueDate: true,
      paidAt: true,
      publicNote: true,
    },
  });

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    invoices: invoices.map((i) => ({
      ...i,
      amount: Number(i.amount),
      vatRate: Number(i.vatRate),
      vatAmount: Number(i.vatAmount),
      totalAmount: Number(i.totalAmount),
    })),
    mode,
  });
}

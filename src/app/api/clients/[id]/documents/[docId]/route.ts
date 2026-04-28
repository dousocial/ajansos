import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteFromSupabase } from "@/lib/storage";

// DELETE /api/clients/[id]/documents/[docId] — döküman sil (soft delete + storage purge)
type Params = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok" }, { status: 403 });
  }

  const { id, docId } = await params;

  const doc = await prisma.clientDocument.findUnique({
    where: { id: docId, deletedAt: null },
  });
  if (!doc || doc.clientId !== id) {
    return NextResponse.json({ error: "Döküman bulunamadı" }, { status: 404 });
  }

  // Önce storage'dan sil — başarısız olursa DB'yi de bozmayalım.
  try {
    await deleteFromSupabase(doc.storageKey);
  } catch (e) {
    // Storage silme başarısız olsa da DB'de soft-delete yapıyoruz; orphan
    // dosyayı cleanup-media cron temizler.
    console.warn("[doc DELETE] storage purge başarısız:", e);
  }

  await prisma.clientDocument.update({
    where: { id: docId },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

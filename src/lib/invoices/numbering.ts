import { prisma } from "@/lib/prisma";

/**
 * Sıralı fatura numarası üretir: "2026-0001", "2026-0002", ..., yılda sıfırlanır.
 *
 * Basit, yarış koşuluna dayanıklı değildir — yan yana POST istekleri aynı numarayı
 * alabilir. Invoice.invoiceNumber @unique olduğu için ikinci ekleme başarısız olur;
 * çağıran taraf retry ile yeni numara talep eder. Çok yüksek trafikli durumlarda
 * daha güvenilir bir sequence'e taşınmalı.
 */
export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `${year}-`;

  // Bu yılın en büyük numarasını bul
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  const lastSeq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) : 0;
  const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

import type { SubscriptionInterval } from "@/generated/prisma/enums";

/**
 * Bir abonelik için bir sonraki fatura tarihini hesaplar.
 *
 * MONTHLY → +1 ay, QUARTERLY → +3 ay, YEARLY → +1 yıl. Ay sonu durumları için
 * `setMonth` doğal olarak "30 Ocak + 1 ay = 2/3 Mart" gibi taşmalar yapabilir —
 * bu MVP için kabul edilebilir (retainer faturaları genelde ayın aynı günü
 * kesilir, ay sonu edge case'i nadir).
 */
export function advanceInvoiceDate(from: Date, interval: SubscriptionInterval): Date {
  const d = new Date(from);
  switch (interval) {
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      return d;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      return d;
  }
}

/** Varsayılan vade: düzenleme tarihinden +N gün (MVP: 14). */
export function defaultDueDate(issueDate: Date = new Date(), days: number = 14): Date {
  const d = new Date(issueDate);
  d.setDate(d.getDate() + days);
  return d;
}

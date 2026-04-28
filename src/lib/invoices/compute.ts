/**
 * Fatura tutarı hesapları.
 *
 * Prisma `Decimal` hem `number` hem string/Decimal olarak gelebilir. Para hesabında
 * JS `number` kaybı olmaması için string → toplam → 2 ondalık yuvarlama yapıyoruz.
 * Prisma `@db.Decimal(12, 2)` zaten DB seviyesinde 2 ondalık tutuyor; biz sadece
 * API/JSON katmanında tutarlılık sağlıyoruz.
 */

export type AmountInput = number | string | { toString(): string };

export interface InvoiceAmounts {
  amount: number; // KDV öncesi
  vatRate: number; // % (0–100)
  vatAmount: number;
  totalAmount: number;
}

/** "12.34" / 12.34 / Decimal → JS number (2 ondalığa yuvarlanmış) */
export function toNumber(value: AmountInput): number {
  const n = typeof value === "number" ? value : parseFloat(value.toString());
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** KDV ve toplam tutarı hesapla. */
export function computeAmounts(amount: AmountInput, vatRate: AmountInput): InvoiceAmounts {
  const a = toNumber(amount);
  const r = toNumber(vatRate);
  const vatAmount = Math.round(a * r) / 100; // a * (r/100) — sonra 2 ondalık
  const totalAmount = Math.round((a + vatAmount) * 100) / 100;
  return {
    amount: a,
    vatRate: r,
    vatAmount: Math.round(vatAmount * 100) / 100,
    totalAmount,
  };
}

/** Türk lirası / USD / EUR format: "1.234,56 ₺" */
export function formatCurrency(amount: AmountInput, currency: "TRY" | "USD" | "EUR" = "TRY"): string {
  const n = toNumber(amount);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export const CURRENCY_SYMBOLS: Record<"TRY" | "USD" | "EUR", string> = {
  TRY: "₺",
  USD: "$",
  EUR: "€",
};

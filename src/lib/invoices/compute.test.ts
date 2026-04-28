import { describe, it, expect } from "vitest";
import { toNumber, computeAmounts, formatCurrency } from "./compute";

describe("invoices/compute", () => {
  describe("toNumber", () => {
    it("rounds to 2 decimals", () => {
      expect(toNumber(12.345)).toBe(12.35);
      expect(toNumber("99.999")).toBe(100);
    });
    it("handles Decimal-like objects via toString", () => {
      expect(toNumber({ toString: () => "42.50" })).toBe(42.5);
    });
    it("returns 0 for invalid input", () => {
      expect(toNumber("abc")).toBe(0);
      expect(toNumber(NaN)).toBe(0);
    });
  });

  describe("computeAmounts", () => {
    it("computes 20% VAT correctly", () => {
      const r = computeAmounts(100, 20);
      expect(r.amount).toBe(100);
      expect(r.vatRate).toBe(20);
      expect(r.vatAmount).toBe(20);
      expect(r.totalAmount).toBe(120);
    });

    it("handles 0 VAT", () => {
      const r = computeAmounts("250.00", 0);
      expect(r.vatAmount).toBe(0);
      expect(r.totalAmount).toBe(250);
    });

    it("rounds tricky 18% on 99.99 cleanly", () => {
      const r = computeAmounts(99.99, 18);
      // 99.99 * 0.18 = 17.9982 → 17.999... matemati, Math.round((9999*18))/100 = 17.998 → 18
      // Bizim formül: Math.round(a*r)/100 = Math.round(99.99*18)/100 = Math.round(1799.82)/100 = 17.99... aslında 1800/100=18
      expect(r.vatAmount).toBeCloseTo(18, 2);
      expect(r.totalAmount).toBeCloseTo(117.99, 1);
    });
  });

  describe("formatCurrency", () => {
    it("formats TRY with Turkish locale", () => {
      const out = formatCurrency(1234.5, "TRY");
      // Locale formatı sistem bağımlı olabiliyor; sadece sembol + numara olmalı.
      expect(out).toMatch(/1\.234,50/);
      expect(out).toMatch(/₺/);
    });
  });
});

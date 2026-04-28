import { describe, it, expect } from "vitest";
import { advanceInvoiceDate, defaultDueDate } from "./schedule";

describe("invoices/schedule", () => {
  describe("advanceInvoiceDate", () => {
    it("advances MONTHLY by 1 month", () => {
      const r = advanceInvoiceDate(new Date("2026-01-15T00:00:00Z"), "MONTHLY");
      expect(r.toISOString().slice(0, 10)).toBe("2026-02-15");
    });
    it("advances QUARTERLY by 3 months", () => {
      const r = advanceInvoiceDate(new Date("2026-01-15T00:00:00Z"), "QUARTERLY");
      expect(r.toISOString().slice(0, 10)).toBe("2026-04-15");
    });
    it("advances YEARLY by 1 year", () => {
      const r = advanceInvoiceDate(new Date("2026-01-15T00:00:00Z"), "YEARLY");
      expect(r.toISOString().slice(0, 10)).toBe("2027-01-15");
    });
    it("does not mutate the input", () => {
      const input = new Date("2026-01-15T00:00:00Z");
      const before = input.getTime();
      advanceInvoiceDate(input, "MONTHLY");
      expect(input.getTime()).toBe(before);
    });
  });

  describe("defaultDueDate", () => {
    it("adds 14 days by default", () => {
      const r = defaultDueDate(new Date("2026-04-01T00:00:00Z"));
      expect(r.toISOString().slice(0, 10)).toBe("2026-04-15");
    });
    it("respects custom days", () => {
      const r = defaultDueDate(new Date("2026-04-01T00:00:00Z"), 30);
      expect(r.toISOString().slice(0, 10)).toBe("2026-05-01");
    });
  });
});

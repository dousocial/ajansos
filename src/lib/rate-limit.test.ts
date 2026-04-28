import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rate-limit", () => {
  it("allows requests under the limit", () => {
    const key = `t1:${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const r = rateLimit({ key, limit: 5, windowMs: 1000 });
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks once limit exceeded", () => {
    const key = `t2:${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit({ key, limit: 3, windowMs: 1000 });
    const r = rateLimit({ key, limit: 3, windowMs: 1000 });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates different keys", () => {
    const k1 = `t3a:${Math.random()}`;
    const k2 = `t3b:${Math.random()}`;
    rateLimit({ key: k1, limit: 1, windowMs: 1000 });
    expect(rateLimit({ key: k1, limit: 1, windowMs: 1000 }).allowed).toBe(false);
    expect(rateLimit({ key: k2, limit: 1, windowMs: 1000 }).allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    const key = `t4:${Math.random()}`;
    rateLimit({ key, limit: 1, windowMs: 50 });
    expect(rateLimit({ key, limit: 1, windowMs: 50 }).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    expect(rateLimit({ key, limit: 1, windowMs: 50 }).allowed).toBe(true);
  });
});

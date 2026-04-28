/**
 * Lightweight in-memory rate limiter (sliding window-ish, fixed bucket).
 *
 * Vercel serverless'te her instance kendi memory'sine sahip → distributed
 * koruma değil; ama tek instance'a düşen burst trafiği bastırır. Üst sınır
 * için Vercel/Cloudflare WAF veya Upstash Redis ileride eklenir.
 *
 * Kullanım:
 *   import { rateLimit } from "@/lib/rate-limit";
 *   const rl = rateLimit({ key: `ai:${userId}`, limit: 30, windowMs: 60_000 });
 *   if (!rl.allowed) return new NextResponse("Çok hızlı", { status: 429 });
 *
 * IP tabanlı için `keyFromRequest()` helper'ı.
 *
 * Bellek temizliği: Map sürekli büyümesin diye her çağrıda expire olmuş
 * bucketları temizliyoruz (her ~1000 çağrıda bir tam scan).
 */

import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let opCount = 0;

function gc(now: number) {
  // Tam scan pahalı; sadece arada bir.
  if (++opCount % 1000 !== 0) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  gc(now);

  const existing = buckets.get(opts.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return {
      allowed: true,
      remaining: opts.limit - 1,
      retryAfterSeconds: 0,
      resetAt: now + opts.windowMs,
    };
  }

  if (existing.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: opts.limit - existing.count,
    retryAfterSeconds: 0,
    resetAt: existing.resetAt,
  };
}

/**
 * NextRequest'ten kararlı bir IP/anahtar çıkar. Vercel `x-forwarded-for`
 * en üstteki ilk IP gerçek istemciyi verir (proxy chain'de). Yoksa
 * `cf-connecting-ip` veya `x-real-ip`. Hiçbiri yoksa "unknown" — yine de
 * anonim akış burst'ünü kontrol eder.
 */
export function keyFromRequest(req: NextRequest, prefix: string): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",")[0]?.trim() : "") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Standart 429 yanıtı için header builder.
 */
export function rateLimitHeaders(r: RateLimitResult, limit: number): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, r.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
    ...(r.allowed ? {} : { "Retry-After": String(r.retryAfterSeconds) }),
  };
}

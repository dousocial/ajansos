/**
 * Type-safe environment variable validator.
 *
 * Tek noktadan env doğrulama → process.env.X kontrol etmek yerine
 * `import { env } from "@/lib/env"` ile typed erişim. Eksik zorunlu
 * değişkenleri build/boot anında yakalar — runtime'da pattern olarak
 * görünmez surprise'lara yol açmaz.
 *
 * Kategoriler:
 *  - Core: DATABASE, AUTH, ENCRYPTION → eksikse uygulama HİÇ açılmaz
 *  - Optional integrations: META, LINKEDIN, GOOGLE, TIKTOK, RESEND, GEMINI
 *    → yoksa o feature graceful disable eder (UI'da uyarı, API 503/skip)
 *  - Agency identity: fatura/email içinde görünen ajans bilgisi
 *
 * Optional değişkenler eksikken sadece "log warn + ilgili özellik kapalı".
 * Asla `throw` yapmaz çünkü dev ortamında çoğu integration optional.
 */

import { z } from "zod";

const envSchema = z.object({
  // ─── Core (zorunlu) ──────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url("DATABASE_URL geçerli URL olmalı"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET en az 32 karakter olmalı"),
  // 32 byte (64 hex) — AES-256-GCM key
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY 64 hex karakter olmalı"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // ─── Storage (zorunlu — upload akışı core) ────────────────────────
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_BUCKET: z.string().default("media"),

  // ─── Cron (production'da zorunlu, dev'de opsiyonel) ──────────────
  CRON_SECRET: z.string().optional(),

  // ─── Sosyal medya OAuth (her platform opsiyonel) ─────────────────
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),

  // ─── AI / Email ─────────────────────────────────────────────────
  GEMINI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // ─── Ajans kimliği (fatura şablonu) ──────────────────────────────
  AGENCY_NAME: z.string().optional(),
  AGENCY_EMAIL: z.string().email().optional(),
  AGENCY_ADDRESS: z.string().optional(),
  AGENCY_TAX_ID: z.string().optional(),
  AGENCY_TAX_OFFICE: z.string().optional(),
  AGENCY_IBAN: z.string().optional(),

  // ─── Observability (opsiyonel) ───────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Build/boot'ta net hata — process.env.X.length gibi runtime panic yerine.
    throw new Error(`[env] Geçersiz environment:\n${issues}`);
  }
  return parsed.data;
}

// Lazy: ilk import'ta parse et, sonra cache.
// (Next.js build sırasında env eksik olabilir → require() değil import zamanına ertele.)
let cached: Env | null = null;
export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

// Kolay erişim: `env.DATABASE_URL` syntax'ı.
export const env = new Proxy({} as Env, {
  get: (_target, prop: string) => getEnv()[prop as keyof Env],
});

// Feature flag helper'ları — UI'da "X özelliği konfigüre değil" mesajı için.
export const features = {
  meta: () => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  google: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  linkedin: () => Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
  tiktok: () => Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
  email: () => Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
  ai: () => Boolean(env.GEMINI_API_KEY),
  sentry: () => Boolean(env.SENTRY_DSN),
};

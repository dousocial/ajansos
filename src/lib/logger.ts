/**
 * Structured logger.
 *
 * Production'da JSON satırlar (Vercel/Datadog/Logflare okuyabilir),
 * development'ta renkli pretty print. Sentry varsa error level'ları
 * oraya da forwardlanır (lazy import — paket yoksa noop).
 *
 * Kullanım:
 *   import { logger } from "@/lib/logger";
 *   logger.info("publish.started", { postId });
 *   logger.error("publish.failed", { postId, err });
 *
 * `err` bir Error instance ise message + stack otomatik çıkartılır.
 *
 * Neden kendi logger? `console.error` Vercel logs'da görünüyor ama
 * structured field'lar yok → arama/filtre zayıf. Tek satır JSON ile
 * her event için level/event/context aranabilir oluyor.
 */

import { env } from "@/lib/env";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentMin(): number {
  const lvl = (env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug")) as Level;
  return LEVEL_ORDER[lvl] ?? 20;
}

function serializeErr(e: unknown): Record<string, unknown> | unknown {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      ...(e.cause ? { cause: serializeErr(e.cause) } : {}),
    };
  }
  return e;
}

function emit(level: Level, event: string, ctx?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < currentMin()) return;

  const out: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  if (ctx) {
    for (const [k, v] of Object.entries(ctx)) {
      out[k] = k === "err" || k === "error" ? serializeErr(v) : v;
    }
  }

  if (env.NODE_ENV === "production") {
    // JSON line — log aggregator parse eder.
    const line = JSON.stringify(out);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  } else {
    // Dev: okunabilir.
    const tag = `[${level.toUpperCase()}] ${event}`;
    if (ctx && Object.keys(ctx).length) {
      const printable: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ctx)) {
        printable[k] = k === "err" || k === "error" ? serializeErr(v) : v;
      }
      if (level === "error") console.error(tag, printable);
      else if (level === "warn") console.warn(tag, printable);
      else console.log(tag, printable);
    } else {
      if (level === "error") console.error(tag);
      else if (level === "warn") console.warn(tag);
      else console.log(tag);
    }
  }

  // Sentry forward (sadece error/warn) — paket yoksa sessizce skip.
  if ((level === "error" || level === "warn") && env.SENTRY_DSN) {
    forwardToSentry(level, event, ctx).catch(() => {
      // logger içinde patlamasın
    });
  }
}

// Lazy + opsiyonel — paket yüklü değilse hiçbir şey yapmaz.
let sentryReady: Promise<unknown> | null = null;
async function forwardToSentry(
  level: "warn" | "error",
  event: string,
  ctx?: Record<string, unknown>
): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    if (!sentryReady) {
      sentryReady = (async () => {
        try {
          // Dynamic require — turbopack/webpack statik analiz etmesin diye
          // değişken üzerinden çağırıyoruz. @sentry/nextjs yüklü değilse
          // build warning vermez, runtime'da bu catch yakalar.
          const pkg = "@sentry/nextjs";
          const Sentry = await import(/* webpackIgnore: true */ /* @vite-ignore */ pkg);
          if (typeof (Sentry as { init?: (opts: unknown) => void }).init === "function") {
            (Sentry as { init: (opts: unknown) => void }).init({
              dsn: env.SENTRY_DSN,
              tracesSampleRate: 0,
              environment: env.NODE_ENV,
            });
          }
          return Sentry;
        } catch {
          return null;
        }
      })();
    }
    const mod = (await sentryReady) as
      | {
          captureMessage?: (msg: string, opts?: unknown) => void;
          captureException?: (err: unknown, opts?: unknown) => void;
        }
      | null;
    if (!mod) return;
    const err = ctx?.err ?? ctx?.error;
    if (err instanceof Error && mod.captureException) {
      mod.captureException(err, { level, tags: { event }, extra: ctx });
    } else if (mod.captureMessage) {
      mod.captureMessage(event, { level, extra: ctx });
    }
  } catch {
    // ignore
  }
}

export const logger = {
  debug: (event: string, ctx?: Record<string, unknown>) => emit("debug", event, ctx),
  info: (event: string, ctx?: Record<string, unknown>) => emit("info", event, ctx),
  warn: (event: string, ctx?: Record<string, unknown>) => emit("warn", event, ctx),
  error: (event: string, ctx?: Record<string, unknown>) => emit("error", event, ctx),
};

export type Logger = typeof logger;

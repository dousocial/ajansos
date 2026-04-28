/**
 * Genel amaçlı e-posta yardımcı.
 *
 * Resend istemcisi tek noktadan paylaşılır (önceden invoices/email.ts kendi
 * client'ını yönetiyordu — burası ortak çekirdek). RESEND_API_KEY tanımlı
 * değilse bütün send fonksiyonları "skipped" döner; hata fırlatmıyoruz çünkü
 * dev ortamı çoğu zaman e-posta entegrasyonu olmadan çalışır.
 *
 * Kullanım örnekleri:
 *   sendNotificationEmail({ to, subject, heading, lines, ctaText, ctaUrl })
 *   getResendClient() → ileri seviye senaryolar (örn. attachment) için.
 */

import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

let cached: Resend | null = null;

export function getResendClient(): Resend | null {
  if (cached) return cached;
  if (!env.RESEND_API_KEY) return null;
  cached = new Resend(env.RESEND_API_KEY);
  return cached;
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

export interface NotificationEmailInput {
  to: string | string[];
  subject: string;
  heading: string;
  lines: string[]; // her biri ayrı paragraf (HTML escape edilir)
  ctaText?: string;
  ctaUrl?: string;
  /** UI'da hata/uyarı tonu. */
  variant?: "info" | "warning" | "danger";
}

/**
 * Bildirim e-postası gönderir. Brand-light bir HTML şablonu kullanır.
 */
export async function sendNotificationEmail(input: NotificationEmailInput): Promise<SendResult> {
  const c = getResendClient();
  if (!c) {
    return { ok: false, skipped: true, reason: "RESEND_API_KEY missing" };
  }

  const from = env.RESEND_FROM_EMAIL ?? "no-reply@ajansos.com";
  const headColor =
    input.variant === "danger"
      ? "#dc2626"
      : input.variant === "warning"
      ? "#f59e0b"
      : "#3b82f6";

  const paragraphs = input.lines
    .map((l) => `<p style="margin: 0 0 12px 0;">${escapeHtml(l)}</p>`)
    .join("\n");

  const cta =
    input.ctaText && input.ctaUrl
      ? `<p style="margin-top: 20px;"><a href="${input.ctaUrl}" style="display: inline-block; background: ${headColor}; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">${escapeHtml(input.ctaText)}</a></p>`
      : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: ${headColor}; margin: 0 0 16px 0; font-size: 20px;">${escapeHtml(input.heading)}</h2>
      ${paragraphs}
      ${cta}
      <p style="font-size: 12px; color: #9ca3af; margin-top: 28px;">Bu bildirim ajans yönetim platformundan otomatik olarak gönderildi.</p>
    </div>
  `;

  try {
    const res = await c.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html,
    });
    if (res.error) {
      logger.warn("email.send_error", { subject: input.subject, err: res.error });
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res.data?.id ?? "unknown" };
  } catch (e) {
    logger.error("email.exception", { subject: input.subject, err: e });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

import { Resend } from "resend";
import { formatCurrency } from "./compute";

/**
 * Resend istemcisi ve fatura e-posta şablonları.
 *
 * RESEND_API_KEY yoksa `sendInvoiceEmail` 0 başarı/0 hata ile "atlandı" döner —
 * dev ortamında hata fırlatmıyoruz, log'a uyarı düşüyoruz. Production'da env
 * ayarlanmalı (aksi halde müşteri fatura e-postası alamaz).
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export interface SendInvoiceEmailInput {
  to: string; // müşteri e-posta
  cc?: string[]; // opsiyonel: ajans içi kopya
  invoiceNumber: string;
  clientName: string;
  sellerName: string;
  dueDate: Date;
  totalAmount: number;
  currency: "TRY" | "USD" | "EUR";
  portalUrl: string; // müşterinin faturayı görüp indirebileceği link
  pdfBuffer: Buffer; // ek olarak gönderilecek PDF
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<
  { ok: true; id: string } | { ok: false; skipped: true; reason: string } | { ok: false; error: string }
> {
  const c = getClient();
  if (!c) {
    console.warn("[invoices/email] RESEND_API_KEY yok — fatura e-postası atlandı");
    return { ok: false, skipped: true, reason: "RESEND_API_KEY missing" };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@ajansos.com";
  const subject = `${input.sellerName} — Fatura ${input.invoiceNumber}`;
  const dueStr = input.dueDate.toLocaleDateString("tr-TR");
  const totalStr = formatCurrency(input.totalAmount, input.currency);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #3b82f6; margin-bottom: 8px;">Yeni Faturanız Hazır</h2>
      <p>Merhaba <strong>${escapeHtml(input.clientName)}</strong>,</p>
      <p>${escapeHtml(input.sellerName)} tarafından adınıza düzenlenen fatura ektedir.</p>
      <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Fatura No</td><td style="text-align: right; font-weight: 600;">${escapeHtml(input.invoiceNumber)}</td></tr>
          <tr><td style="color: #6b7280;">Tutar</td><td style="text-align: right; font-weight: 600;">${totalStr}</td></tr>
          <tr><td style="color: #6b7280;">Vade</td><td style="text-align: right; font-weight: 600;">${dueStr}</td></tr>
        </table>
      </div>
      <p><a href="${input.portalUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">Müşteri Portalında Görüntüle</a></p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">Sorularınız için bu e-postaya yanıt verebilirsiniz.</p>
    </div>
  `;

  try {
    const res = await c.emails.send({
      from,
      to: input.to,
      cc: input.cc,
      subject,
      html,
      attachments: [
        {
          filename: `fatura-${input.invoiceNumber}.pdf`,
          content: input.pdfBuffer,
        },
      ],
    });

    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id ?? "unknown" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[invoices/email] Resend hatası:", msg);
    return { ok: false, error: msg };
  }
}

export interface SendReminderEmailInput {
  to: string;
  invoiceNumber: string;
  clientName: string;
  sellerName: string;
  dueDate: Date;
  daysUntilDue: number; // negatif = gecikme
  totalAmount: number;
  currency: "TRY" | "USD" | "EUR";
  portalUrl: string;
}

export async function sendReminderEmail(input: SendReminderEmailInput): Promise<
  { ok: true; id: string } | { ok: false; skipped: true; reason: string } | { ok: false; error: string }
> {
  const c = getClient();
  if (!c) {
    console.warn("[invoices/email] RESEND_API_KEY yok — hatırlatma atlandı");
    return { ok: false, skipped: true, reason: "RESEND_API_KEY missing" };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "no-reply@ajansos.com";
  const overdue = input.daysUntilDue < 0;
  const subject = overdue
    ? `⚠️ Gecikmiş Fatura — ${input.invoiceNumber}`
    : `Hatırlatma: Fatura ${input.invoiceNumber} vadesi yaklaşıyor`;
  const dueStr = input.dueDate.toLocaleDateString("tr-TR");
  const totalStr = formatCurrency(input.totalAmount, input.currency);
  const bodyLine = overdue
    ? `Fatura vadesi <strong>${Math.abs(input.daysUntilDue)} gün önce</strong> (${dueStr}) dolmuştur. Lütfen en kısa sürede ödemenizi gerçekleştirin.`
    : `Fatura vadesi <strong>${input.daysUntilDue} gün sonra</strong> (${dueStr}) dolacak.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: ${overdue ? "#dc2626" : "#f59e0b"}; margin-bottom: 8px;">${overdue ? "Gecikmiş Ödeme" : "Ödeme Hatırlatması"}</h2>
      <p>Merhaba <strong>${escapeHtml(input.clientName)}</strong>,</p>
      <p>${bodyLine}</p>
      <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <table style="width: 100%; font-size: 14px;">
          <tr><td style="color: #6b7280;">Fatura No</td><td style="text-align: right; font-weight: 600;">${escapeHtml(input.invoiceNumber)}</td></tr>
          <tr><td style="color: #6b7280;">Tutar</td><td style="text-align: right; font-weight: 600;">${totalStr}</td></tr>
          <tr><td style="color: #6b7280;">Vade</td><td style="text-align: right; font-weight: 600;">${dueStr}</td></tr>
        </table>
      </div>
      <p><a href="${input.portalUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: 600;">Faturayı Görüntüle</a></p>
    </div>
  `;

  try {
    const res = await c.emails.send({ from, to: input.to, subject, html });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id ?? "unknown" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

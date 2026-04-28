/**
 * Supabase Storage helper — sadece server-side kullan (service_role key gizli).
 *
 * Akış:
 *  1. Kullanıcı /icerikler/yeni formundan dosya seçer
 *  2. Frontend her dosyayı POST /api/upload'a atar (multipart)
 *  3. /api/upload `uploadToSupabase()` çağırıp publicUrl döndürür
 *  4. Form bu publicUrl'i state'te tutup proje create payload'una koyar
 *  5. /api/projects POST File kaydı + ScheduledPost.mediaUrls'e bunu yazar
 *
 * Bucket: SUPABASE_BUCKET (default: ajansos-media). Public olmalı — Meta/LinkedIn
 * gibi platformlar publishUrl'i kendi sunucularından çekiyor.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL ve SUPABASE_SERVICE_KEY .env.local'da tanımlı olmalı"
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

function getBucket(): string {
  return process.env.SUPABASE_BUCKET ?? "ajansos-media";
}

export interface UploadResult {
  storageKey: string;
  publicUrl: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Buffer/File'ı buckete yükler. Path formatı:
 *   projects/<clientId>/<yyyy>/<mm>/<uuid>-<safeName>
 * — clientId path'te olunca müşteri başına dosya gözden geçirmek kolay
 * — yyyy/mm aylık partition listing'i yormasın diye
 * — uuid prefix isim çakışmalarını önler
 */
export async function uploadToSupabase(args: {
  clientId: string;
  fileName: string;
  mimeType: string;
  body: Buffer | Uint8Array | Blob;
  sizeBytes: number;
  // Path prefix override — varsayılan "projects". Müşteri dökümanları için
  // "documents" geçilir → documents/<clientId>/yyyy/mm/uuid-name.
  pathPrefix?: string;
}): Promise<UploadResult> {
  const supabase = getClient();
  const bucket = getBucket();

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");

  // Türkçe karakter / boşluk / özel karakteri stripleyip URL-safe yap.
  // ÖNEMLİ: Uzantıyı slice koruyacak şekilde ayrı tut — Instagram/Facebook fetch
  // sırasında URL uzantısına bakıyor; uzantısız URL "Invalid parameter" döner.
  const lastDot = args.fileName.lastIndexOf(".");
  const baseRaw = lastDot > 0 ? args.fileName.slice(0, lastDot) : args.fileName;
  const extRaw = lastDot > 0 ? args.fileName.slice(lastDot) : "";
  const sanitize = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_");
  const safeBase = sanitize(baseRaw).slice(0, 80);
  const safeExt = sanitize(extRaw).slice(0, 10); // .jpeg/.quicktime vb hepsi sığar
  const safeName = `${safeBase}${safeExt}`;

  const prefix = args.pathPrefix ?? "projects";
  const storageKey = `${prefix}/${args.clientId}/${yyyy}/${mm}/${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(bucket).upload(storageKey, args.body, {
    contentType: args.mimeType,
    cacheControl: "31536000", // 1 yıl — dosyalar immutable (uuid'li path)
    upsert: false,
  });
  if (error) {
    throw new Error(`Supabase upload başarısız: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storageKey);
  if (!urlData?.publicUrl) {
    throw new Error("Public URL alınamadı (bucket public mi?)");
  }

  return {
    storageKey,
    publicUrl: urlData.publicUrl,
    name: args.fileName,
    mimeType: args.mimeType,
    sizeBytes: args.sizeBytes,
  };
}

/** Bir storageKey'i sil — proje silindiğinde / dosya değiştirildiğinde çağrılır. */
export async function deleteFromSupabase(storageKey: string): Promise<void> {
  const { error } = await getClient().storage.from(getBucket()).remove([storageKey]);
  if (error) throw new Error(`Supabase delete başarısız: ${error.message}`);
}

export const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter/X",
  YOUTUBE: "YouTube",
};

// Yayınlama backend'inin hazır olduğu platformlar. Her biri için:
//  • src/lib/publish/<platform>.ts → API çağrısı
//  • src/app/api/<platform>/oauth/start + /callback → bağlantı akışı
//  • Dispatcher (src/lib/publish/index.ts) case'i
//
// Twitter/X henüz yok — eklenene kadar UI'da kilitli kalır.
export const SUPPORTED_PUBLISH_PLATFORMS: string[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "YOUTUBE",
  "TIKTOK",
];

export function isPlatformSupported(platform: string): boolean {
  return SUPPORTED_PUBLISH_PLATFORMS.includes(platform);
}

/**
 * Platform için hangi OAuth/API env değişkenlerinin olması gerektiğini anlatır.
 * Anahtar: Platform kodu. Değer: "bu platform canlı olsun" için gerekli env anahtarları.
 *
 * `isPlatformConfigured()` runtime'da bu listeden yola çıkarak gerçekten bağlı
 * olup olmadığını kontrol eder — OAuth butonu göstermek veya "önce .env doldur"
 * uyarısı çıkarmak için kullanılır.
 */
export const PLATFORM_ENV_REQUIREMENTS: Record<string, string[]> = {
  INSTAGRAM: ["META_APP_ID", "META_APP_SECRET"],
  FACEBOOK: ["META_APP_ID", "META_APP_SECRET"],
  LINKEDIN: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  YOUTUBE: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  TIKTOK: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
};

/** Server-side helper. Client bundle'a env sızdırmaz. */
export function isPlatformConfigured(platform: string): boolean {
  const required = PLATFORM_ENV_REQUIREMENTS[platform];
  if (!required) return false;
  return required.every((k) => Boolean(process.env[k]));
}

export const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "bg-pink-100 text-pink-700",
  FACEBOOK: "bg-blue-100 text-blue-700",
  TIKTOK: "bg-slate-100 text-slate-700",
  LINKEDIN: "bg-sky-100 text-sky-700",
  TWITTER: "bg-gray-100 text-gray-700",
  YOUTUBE: "bg-red-100 text-red-700",
};

export const STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planlandı",
  SHOOTING: "Çekimde",
  EDITING: "Kurguda",
  INTERNAL_REVIEW: "İç Onay",
  CLIENT_REVIEW: "Müşteri Onayı",
  APPROVED: "Onaylandı",
  LIVE: "Yayında",
  PUBLISHED: "Yayınlandı",
};

export const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-100 text-gray-600",
  SHOOTING: "bg-blue-100 text-blue-700",
  EDITING: "bg-purple-100 text-purple-700",
  INTERNAL_REVIEW: "bg-amber-100 text-amber-700",
  CLIENT_REVIEW: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
  LIVE: "bg-emerald-100 text-emerald-700",
  PUBLISHED: "bg-slate-100 text-slate-500",
};

export const PIPELINE_ORDER: string[] = [
  "PLANNED",
  "SHOOTING",
  "EDITING",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "APPROVED",
  "LIVE",
  "PUBLISHED",
];

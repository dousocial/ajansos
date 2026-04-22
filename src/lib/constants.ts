export const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  TWITTER: "Twitter/X",
  YOUTUBE: "YouTube",
};

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

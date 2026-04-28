/**
 * TikTok Content Posting API ile video yayını.
 *
 * Akış (Direct Post, FROM_URL):
 *  1. POST /v2/post/publish/video/init/ — { post_info, source_info: { source: "PULL_FROM_URL", video_url } }
 *     Response: { data: { publish_id } }
 *  2. (opsiyonel) POST /v2/post/publish/status/fetch/ polling ile işlem takip
 *     — MVP'de yapmıyoruz; publish_id döner, TikTok arka planda işler, cron
 *       retry'ı 5 dk sonra aynı ScheduledPost'u yeniden denemez çünkü status
 *       zaten "published" olarak işaretlenir. İzleme için ileride webhook/polling.
 *
 * **Önemli:**
 *  - TikTok uygulamanızın **Content Posting API**'ye erişim izni alması için
 *    TikTok for Developers üzerinden app review/audit'ten geçmesi gerekir (bu
 *    1-2 hafta alabilir). Aksi halde `scope` hatası alırsınız.
 *  - `video_url` TikTok'un erişebileceği, SSL sertifikalı ve uygulamanızın
 *    "verified domain"leri arasındaki bir URL olmalı. Supabase Storage public
 *    URL'leri çalışır ama Supabase domain'ini TikTok developer panelinde
 *    verified domain olarak eklemeniz gerekir.
 *  - Photo carousel için ayrı endpoint: `/v2/post/publish/content/init/`
 *    (MVP'de yok — video-only destekliyoruz, TikTok content %95 video zaten)
 *
 * Scope: `video.publish,video.upload,user.info.basic`
 * accountId callback'te open_id olarak kaydedilmiş olmalı.
 */

import type { ExternalId, PublishContext } from "./types";

interface TikTokInitResponse {
  data?: {
    publish_id: string;
    upload_url?: string;
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

interface TikTokTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

function splitToken(combined: string): { access: string; refresh: string | null } {
  const [access, refresh] = combined.split("|");
  return { access: access ?? combined, refresh: refresh ?? null };
}

async function refreshTikTokToken(refreshToken: string): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TIKTOK_CLIENT_KEY ve TIKTOK_CLIENT_SECRET tanımlı değil");
  }

  const params = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await res.json()) as TikTokTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "TikTok token yenilenemedi");
  }
  return data.access_token;
}

async function initTikTokVideoPost(
  accessToken: string,
  videoUrl: string,
  title: string
): Promise<string> {
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: title.slice(0, 2200), // TikTok caption max 2200 char
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    }),
  });

  const data = (await res.json()) as TikTokInitResponse;
  if (!res.ok || !data.data?.publish_id) {
    const msg = data.error?.message ?? `TikTok init başarısız (${res.status})`;
    throw new Error(
      data.error?.code === "url_ownership_unverified"
        ? `${msg} — video_url domain'ini TikTok developer panelinde "verified domain" olarak ekleyin`
        : msg
    );
  }

  return data.data.publish_id;
}

export async function publishTikTok(ctx: PublishContext): Promise<ExternalId> {
  const { accessToken, caption, mediaUrls, postType } = ctx;

  if (postType !== "VIDEO" && postType !== "REEL") {
    throw new Error(`TikTok sadece VIDEO/REEL destekler (gelen: ${postType})`);
  }
  if (mediaUrls.length === 0) {
    throw new Error("TikTok yayını için video URL'i gerekli");
  }

  const { access, refresh } = splitToken(accessToken);

  try {
    return await initTikTokVideoPost(access, mediaUrls[0], caption);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAuthError = msg.includes("access_token_invalid") || msg.includes("401");
    if (isAuthError && refresh) {
      const fresh = await refreshTikTokToken(refresh);
      return initTikTokVideoPost(fresh, mediaUrls[0], caption);
    }
    throw e;
  }
}

/**
 * YouTube Data API v3 ile video yayını (Shorts dahil).
 *
 * Akış (resumable upload — Google'ın önerdiği yol):
 *  1. POST /upload/youtube/v3/videos?uploadType=resumable&part=snippet,status
 *     Body: { snippet: { title, description, tags }, status: { privacyStatus } }
 *     Response header: `Location: {sessionUrl}`
 *  2. PUT {sessionUrl} with video binary (single shot çoğu MVP için yeter;
 *     chunked resumable upload ileride gerekirse eklenir)
 *  3. Response: video resource { id, snippet, status, ... }
 *
 * Shorts tanımı: dikey (≤1080x1920), ≤60 sn. Google otomatik algılar, ama
 * title/description'a `#Shorts` eklemek önerilir — biz caption sonuna ekliyoruz.
 *
 * Scope: `https://www.googleapis.com/auth/youtube.upload`
 * accountId callback'te channelId olarak kaydedilmiş olmalı.
 *
 * NOT: Google access_token'ı 1 saatte expire eder. Scope `offline` ile
 * refresh_token almak gerekir — OAuth callback refresh_token'ı tokenEnc'e
 * `access:refresh` formatında şifreliyor, publish anında önce access'i
 * kullanıyor, 401 alırsak refresh ile yenileyip retry ediyoruz.
 */

import type { ExternalId, PublishContext } from "./types";

interface YoutubeVideoResource {
  id?: string;
  error?: { code: number; message: string };
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * Token `access_token|refresh_token` birleşik formatı. Callback bu formatta
 * şifreler. Publish zamanında access ile dene, 401 olursa refresh ile yenile.
 */
function splitToken(combined: string): { access: string; refresh: string | null } {
  const [access, refresh] = combined.split("|");
  return { access: access ?? combined, refresh: refresh ?? null };
}

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET tanımlı değil");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Google token yenilenemedi");
  }
  return data.access_token;
}

async function uploadYoutubeVideo(
  accessToken: string,
  mediaUrl: string,
  title: string,
  description: string,
  tags: string[]
): Promise<string> {
  // Adım 1: Resumable session başlat
  const metaRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify({
        snippet: {
          title: title.slice(0, 100), // YouTube title max 100 char
          description,
          tags: tags.slice(0, 500), // opsiyonel
          categoryId: "22", // People & Blogs
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!metaRes.ok) {
    const errData = (await metaRes.json().catch(() => ({}))) as YoutubeVideoResource;
    // 401 yukarıda caller retry etsin diye throw'da ayrıştırılabilir
    throw new Error(
      errData.error?.message ?? `YouTube upload session oluşturulamadı (${metaRes.status})`
    );
  }

  const sessionUrl = metaRes.headers.get("location");
  if (!sessionUrl) {
    throw new Error("YouTube session URL alınamadı (Location header yok)");
  }

  // Adım 2: Medyayı Supabase'ten çek, session URL'e PUT et
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) {
    throw new Error(`Video çekilemedi: ${mediaRes.status} ${mediaRes.statusText}`);
  }
  const videoBuffer = Buffer.from(await mediaRes.arrayBuffer());

  const putRes = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/*",
      "Content-Length": videoBuffer.length.toString(),
    },
    body: videoBuffer,
  });

  const data = (await putRes.json()) as YoutubeVideoResource;
  if (!putRes.ok || data.error) {
    throw new Error(data.error?.message ?? `YouTube upload başarısız (${putRes.status})`);
  }
  if (!data.id) {
    throw new Error("YouTube upload sonucu video ID içermiyor");
  }
  return data.id;
}

export async function publishYouTube(ctx: PublishContext): Promise<ExternalId> {
  const { accessToken, caption, mediaUrls, postType } = ctx;

  if (postType !== "VIDEO" && postType !== "REEL") {
    throw new Error(`YouTube sadece VIDEO/REEL destekler (gelen: ${postType})`);
  }
  if (mediaUrls.length === 0) {
    throw new Error("YouTube yayını için video URL'i gerekli");
  }

  // Shorts hint
  const isShort = postType === "REEL";
  const tags = isShort ? ["Shorts"] : [];
  const description = isShort && !caption.includes("#Shorts") ? `${caption}\n\n#Shorts` : caption;
  const title = caption.split("\n")[0]?.slice(0, 95) || "Yeni video";

  const { access, refresh } = splitToken(accessToken);

  try {
    return await uploadYoutubeVideo(access, mediaUrls[0], title, description, tags);
  } catch (e) {
    // Token expired ise refresh ile tekrar dene (Google access_token 1 saat)
    const msg = e instanceof Error ? e.message : String(e);
    const isAuthError = msg.includes("401") || msg.toLowerCase().includes("invalid credentials");
    if (isAuthError && refresh) {
      const fresh = await refreshGoogleToken(refresh);
      return uploadYoutubeVideo(fresh, mediaUrls[0], title, description, tags);
    }
    throw e;
  }
}

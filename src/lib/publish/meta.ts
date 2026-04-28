/**
 * Meta Graph API ile Instagram & Facebook yayını.
 *
 * Tüm Graph çağrılarında access token `Authorization: OAuth <token>` header'ı
 * ile gönderiliyor — eskiden query string'deydi, Vercel/Cloudflare/Supabase
 * access loglarına long-lived IG page token'ı plaintext düşüyordu (güvenlik
 * fix). Body içine de yazmıyoruz; tek noktadan auth.
 */

import type { ExternalId, PublishContext } from "./types";

interface GraphApiError {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
}

interface GraphApiResponse {
  id?: string;
  error?: GraphApiError;
}

interface ContainerStatusResponse {
  status_code?: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";
  status?: string;
  error?: { message: string; code: number };
}

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

/**
 * Instagram carousel limiti (Meta dokümanı: max 10 child).
 * Üstüne çıkıldığında Graph "too many children" döner — biz erken yakalayalım.
 */
const IG_CAROUSEL_MAX_CHILDREN = 10;

/**
 * Container hazır-bekleme süreleri. Image hızlı (~1-3 sn), video/reels uzun
 * (transcode gerekir). Cron serverless ortamında 60 sn sınırını aşmamak için
 * üst sınırlar muhafazakar.
 */
const IG_IMAGE_POLL = { maxAttempts: 10, intervalMs: 1500 };
const IG_VIDEO_POLL = { maxAttempts: 30, intervalMs: 2000 };
const IG_CAROUSEL_POLL = { maxAttempts: 15, intervalMs: 2000 };

function formatGraphError(err: GraphApiError): string {
  const parts: string[] = [];
  parts.push(err.error_user_msg ?? err.message ?? "Meta API hatası");
  const meta: string[] = [];
  if (err.code != null) meta.push(`code=${err.code}`);
  if (err.error_subcode != null) meta.push(`subcode=${err.error_subcode}`);
  if (err.fbtrace_id) meta.push(`trace=${err.fbtrace_id}`);
  if (meta.length > 0) parts.push(`(${meta.join(" ")})`);
  return parts.join(" ");
}

/** Token'ı header'dan iletmek için tekil fetch helper'ı. */
async function graphFetch(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `OAuth ${accessToken}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: GraphApiError } & Record<string, unknown>;
  if (!res.ok || data.error) {
    throw new Error(data.error ? formatGraphError(data.error) : `Graph isteği başarısız (${res.status})`);
  }
  return data;
}

async function createIgContainer(
  accessToken: string,
  instagramId: string,
  params: Record<string, string>
): Promise<string> {
  const data = (await graphFetch(`${GRAPH_BASE}/${instagramId}/media`, accessToken, {
    method: "POST",
    body: JSON.stringify(params),
  })) as GraphApiResponse;
  if (!data.id) throw new Error("Instagram media container oluşturulamadı (id yok)");
  return data.id;
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  { maxAttempts = 30, intervalMs = 2000 }: { maxAttempts?: number; intervalMs?: number } = {}
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const data = (await graphFetch(
      `${GRAPH_BASE}/${containerId}?fields=status_code`,
      accessToken
    )) as ContainerStatusResponse;
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error(`Container durumu: ${data.status_code}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Container işlemeye devam ediyor — zaman aşımı. Sonra tekrar deneyin.");
}

async function publishIgContainer(
  accessToken: string,
  instagramId: string,
  containerId: string
): Promise<string> {
  const data = (await graphFetch(`${GRAPH_BASE}/${instagramId}/media_publish`, accessToken, {
    method: "POST",
    body: JSON.stringify({ creation_id: containerId }),
  })) as GraphApiResponse;
  if (!data.id) throw new Error("Instagram media_publish başarısız (id yok)");
  return data.id;
}

export async function publishInstagram(ctx: PublishContext): Promise<ExternalId> {
  const { accessToken, instagramId, caption, mediaUrls, postType } = ctx;
  if (!instagramId) throw new Error("instagramId is not set on SocialAccount");
  if (mediaUrls.length === 0) throw new Error("Yayın için medya URL'i gerekli");

  if (postType === "IMAGE") {
    const containerId = await createIgContainer(accessToken, instagramId, {
      image_url: mediaUrls[0],
      caption,
    });
    await waitForContainerReady(accessToken, containerId, IG_IMAGE_POLL);
    return publishIgContainer(accessToken, instagramId, containerId);
  }

  if (postType === "VIDEO" || postType === "REEL") {
    const containerId = await createIgContainer(accessToken, instagramId, {
      media_type: postType === "REEL" ? "REELS" : "VIDEO",
      video_url: mediaUrls[0],
      caption,
    });
    await waitForContainerReady(accessToken, containerId, IG_VIDEO_POLL);
    return publishIgContainer(accessToken, instagramId, containerId);
  }

  if (postType === "CAROUSEL") {
    if (mediaUrls.length < 2) throw new Error("Carousel için en az 2 medya gerekir");
    if (mediaUrls.length > IG_CAROUSEL_MAX_CHILDREN) {
      throw new Error(`Carousel en fazla ${IG_CAROUSEL_MAX_CHILDREN} medya destekler`);
    }
    const childIds = await Promise.all(
      mediaUrls.map((url) =>
        createIgContainer(accessToken, instagramId, {
          image_url: url,
          is_carousel_item: "true",
        })
      )
    );
    const parentId = await createIgContainer(accessToken, instagramId, {
      media_type: "CAROUSEL",
      caption,
      children: childIds.join(","),
    });
    await waitForContainerReady(accessToken, parentId, IG_CAROUSEL_POLL);
    return publishIgContainer(accessToken, instagramId, parentId);
  }

  // STORY ve diğer postType'lar henüz implement edilmedi.
  throw new Error(`Instagram için desteklenmeyen post tipi: ${postType}`);
}

export async function publishFacebook(ctx: PublishContext): Promise<ExternalId> {
  const { accessToken, pageId, caption, mediaUrls, postType } = ctx;
  if (!pageId) throw new Error("pageId is not set on SocialAccount");
  if (mediaUrls.length === 0) throw new Error("Facebook post için medya URL'i gerekli");

  // STORY postType'ı sessizce IMAGE'e fallthrough etmesin — açık reddedelim.
  if (postType === "STORY") {
    throw new Error("Facebook STORY yayını henüz desteklenmiyor");
  }

  if (postType === "VIDEO" || postType === "REEL") {
    const data = (await graphFetch(`${GRAPH_BASE}/${pageId}/videos`, accessToken, {
      method: "POST",
      body: JSON.stringify({ file_url: mediaUrls[0], description: caption }),
    })) as GraphApiResponse;
    if (!data.id) throw new Error("Facebook video yayınlanamadı (id yok)");
    return data.id;
  }

  // IMAGE / CAROUSEL fallback → /photos. (CAROUSEL Facebook'ta tek-photo gibi
  // davranır; multi-photo desteği için ayrı pipeline gerekir — ileride.)
  const data = (await graphFetch(`${GRAPH_BASE}/${pageId}/photos`, accessToken, {
    method: "POST",
    body: JSON.stringify({ url: mediaUrls[0], caption }),
  })) as GraphApiResponse;
  if (!data.id) throw new Error("Facebook post yayınlanamadı (id yok)");
  return data.id;
}

/**
 * LinkedIn UGC Posts API ile yayın.
 *
 * Akış:
 *  1. Text-only post için: doğrudan POST /v2/ugcPosts ile author urn:li:person:{id}
 *  2. Image post için: (a) /v2/assets?action=registerUpload ile upload URL al,
 *     (b) Supabase'deki medyayı indirip PUT et, (c) asset URN'i ile UGC post oluştur
 *  3. Video: image ile aynı akış ama recipes="urn:li:digitalmediaRecipe:feedshare-video"
 *
 * **Önemli:** LinkedIn harici URL kabul etmez (Meta'nın aksine) — medya binary'si
 * mutlaka upload edilmeli. Token scope: `w_member_social` (kişisel profil için)
 * veya `w_organization_social` (şirket sayfası için, henüz desteklenmiyor).
 *
 * accessToken çözümü + accountId = urn:li:person:{sub} olarak callback'te set
 * edilmiş olmalı.
 */

import type { ExternalId, PublishContext } from "./types";

interface LinkedInRegisterUploadResponse {
  value?: {
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        uploadUrl: string;
        headers: Record<string, string>;
      };
    };
    asset: string; // urn:li:digitalmediaAsset:xxx
    mediaArtifact: string;
  };
  message?: string;
}

interface LinkedInUgcPostResponse {
  id?: string; // urn:li:share:xxx
  message?: string;
  status?: number;
}

/**
 * LinkedIn'e medya upload eder ve asset URN döndürür.
 * Recipe: image için `feedshare-image`, video için `feedshare-video`.
 */
async function uploadLinkedInMedia(
  accessToken: string,
  memberUrn: string,
  mediaUrl: string,
  kind: "image" | "video"
): Promise<string> {
  const recipe =
    kind === "image"
      ? "urn:li:digitalmediaRecipe:feedshare-image"
      : "urn:li:digitalmediaRecipe:feedshare-video";

  // Adım 1: Upload kaydı aç
  const registerRes = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: [recipe],
          owner: memberUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    }
  );
  const registerData = (await registerRes.json()) as LinkedInRegisterUploadResponse;
  const uploadInfo =
    registerData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ];
  if (!registerRes.ok || !uploadInfo) {
    throw new Error(registerData.message ?? "LinkedIn upload kaydı başarısız");
  }

  // Adım 2: Medyayı Supabase'den çek, LinkedIn'e stream et
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) {
    throw new Error(`Medya çekilemedi: ${mediaRes.status} ${mediaRes.statusText}`);
  }
  const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());

  const putRes = await fetch(uploadInfo.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(uploadInfo.headers ?? {}),
    },
    body: mediaBuffer,
  });
  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    throw new Error(`LinkedIn medya yüklemesi başarısız (${putRes.status}): ${errText}`);
  }

  return registerData.value!.asset;
}

export async function publishLinkedIn(ctx: PublishContext): Promise<ExternalId> {
  const { accessToken, accountId, caption, mediaUrls, postType } = ctx;
  // accountId callback'te `urn:li:person:{sub}` olarak saklandı.
  const memberUrn = accountId.startsWith("urn:li:")
    ? accountId
    : `urn:li:person:${accountId}`;

  const hasMedia = mediaUrls.length > 0;
  const isVideo = postType === "VIDEO" || postType === "REEL";
  const isCarousel = postType === "CAROUSEL";

  // LinkedIn carousel (Document post) farklı bir endpoint kullanır; MVP'de
  // ilk medyayı image olarak paylaş, kalanı at. İleride `/rest/posts` +
  // multiImage article desteği eklenecek.
  const shareMediaCategory = !hasMedia
    ? "NONE"
    : isVideo
      ? "VIDEO"
      : isCarousel
        ? "IMAGE" // ilk görsel, uyarı caption'a eklenir
        : "IMAGE";

  // Medya varsa önce upload
  const mediaEntries: Array<{ status: string; media: string }> = [];
  if (hasMedia) {
    // MVP: tek medya (ilk URL). Multi-image için her URL için ayrı upload gerek.
    const assetUrn = await uploadLinkedInMedia(
      accessToken,
      memberUrn,
      mediaUrls[0],
      isVideo ? "video" : "image"
    );
    mediaEntries.push({ status: "READY", media: assetUrn });
  }

  const body = {
    author: memberUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption || "" },
        shareMediaCategory,
        ...(mediaEntries.length > 0 ? { media: mediaEntries } : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as LinkedInUgcPostResponse;
  const locationHeader = res.headers.get("x-restli-id"); // bazen ID header'da döner

  if (!res.ok) {
    throw new Error(data.message ?? `LinkedIn post başarısız (${res.status})`);
  }

  return data.id ?? locationHeader ?? "unknown";
}

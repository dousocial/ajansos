/**
 * Tüm platform publish fonksiyonlarının paylaştığı tipler.
 *
 * Her platform kendi API şemasına uyum sağlamak için accessToken'ı farklı
 * kullanır (Meta query param, Google Bearer header, TikTok Bearer header)
 * ama publish input'u aynı — böylece tek bir dispatcher yeter.
 */

export type PublishPostType = "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL" | "STORY";

export interface PublishContext {
  /** AES-GCM ile şifre çözülmüş erişim token'ı (her istekte çözülür). */
  accessToken: string;

  /** Platform-bağımlı hesap tanımlayıcıları — publish fonksiyonu hangisini
   *  kullanacağını bilir (IG için instagramId, FB için pageId, YT için
   *  accountId=channelId, LI için accountId=memberUrn, TT için accountId=openId). */
  accountId: string;
  pageId?: string | null;
  instagramId?: string | null;

  /** Hashtag'ler caption'a eklenmiş, tek bir string olarak geçilir. */
  caption: string;

  /** Supabase Storage public URL'leri (veya imzalı URL). Her platform bunları
   *  ya remote fetch eder ya da kendi upload API'sine forward eder. */
  mediaUrls: string[];

  postType: PublishPostType;
}

/** Başarılı publish sonrası platformun döndürdüğü ID (FB/IG: post_id, YT:
 *  videoId, LI: urn:li:share:..., TT: publish_id). Metrik çekme için kullanılır. */
export type ExternalId = string;

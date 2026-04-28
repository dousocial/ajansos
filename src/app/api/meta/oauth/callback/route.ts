/**
 * Meta OAuth callback — Facebook + Instagram'ı tek seferde keşfet ve kaydet.
 *
 * Akış:
 *  1. code → kısa süreli user access token (1 saat)
 *  2. Kısa süreli token'ı UZUN SÜRELİ user token'a takas (60 gün)
 *     — `grant_type=fb_exchange_token`
 *  3. /me/accounts ile kullanıcının yönettiği Facebook Page'leri çek
 *     — Her Page'in kendi `access_token`'ı dönüyor (uzun token'dan türetilmiş
 *       sayfa token'ları KALICI / never expire — ideal yayın için)
 *  4. Her Page için:
 *     a. FACEBOOK SocialAccount kaydı oluştur (page_id + page token)
 *     b. /{page_id}?fields=instagram_business_account ile bağlı IG hesabı varsa
 *        INSTAGRAM SocialAccount kaydı da oluştur (page token + ig user id)
 *
 * Sonuç: tek "Bağla" tıklamasıyla N adet FB sayfası + bağlı IG hesapları
 * keşfedilip ayrı ayrı kayıt ediliyor — Metricool/Buffer akışı.
 *
 * NOT: Müşterinin IG'si Business/Creator değil ya da Page'e bağlı değilse
 * sadece FB satırı oluşur, IG bypass edilir (kullanıcıya warning toast'ı
 * /musteriler sayfasında gösterebilirsiniz, MVP'de sessiz geçiyoruz).
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookPagesResponse {
  data?: Array<{
    id: string;
    name: string;
    access_token: string;
    category?: string;
    tasks?: string[];
  }>;
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
  error?: FacebookErrorResponse["error"];
}

interface InstagramAccountResponse {
  id: string;
  instagram_business_account?: {
    id: string;
  };
  error?: FacebookErrorResponse["error"];
}

interface InstagramUserDetailsResponse {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  error?: FacebookErrorResponse["error"];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const clientId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const errorDesc = searchParams.get("error_description") ?? "OAuth denied";
    return NextResponse.json({ error: errorDesc }, { status: 400 });
  }
  if (!code || !clientId) {
    return NextResponse.json({ error: "Missing code or state parameter" }, { status: 400 });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appId || !appSecret || !appUrl) {
    return NextResponse.json(
      { error: "Meta environment variables are not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/meta/oauth/callback`;

  // ─── Adım 1: code → kısa süreli user token ────────────────────────────────
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json()) as FacebookTokenResponse | FacebookErrorResponse;
  if (!tokenRes.ok || "error" in tokenData) {
    const errMsg = "error" in tokenData ? tokenData.error.message : "Token alınamadı";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
  const shortLivedToken = (tokenData as FacebookTokenResponse).access_token;

  // ─── Adım 2: kısa süreli → uzun süreli user token (60 gün) ────────────────
  const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

  const longRes = await fetch(longLivedUrl.toString());
  const longData = (await longRes.json()) as FacebookTokenResponse | FacebookErrorResponse;
  if (!longRes.ok || "error" in longData) {
    const errMsg =
      "error" in longData ? longData.error.message : "Uzun süreli token alınamadı";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
  const userAccessToken = (longData as FacebookTokenResponse).access_token;
  const userTokenExpiresIn = (longData as FacebookTokenResponse).expires_in;

  // ─── Adım 3: kullanıcının Page'lerini çek ─────────────────────────────────
  // Page tokens (uzun user token'dan türetilen) genelde **expire olmaz** — ideal
  // NOT: `tasks` field'ı bazı durumlarda `pages_manage_metadata` izni ister; eksikse
  // /me/accounts hata yerine sessizce boş dönebiliyor. O yüzden minimal field set
  // ile başlıyoruz, sonra ekstra detay için ikinci çağrı atıyoruz.
  const pagesUrl = new URL("https://graph.facebook.com/v19.0/me/accounts");
  pagesUrl.searchParams.set("fields", "id,name,access_token,category");
  pagesUrl.searchParams.set("limit", "100");
  pagesUrl.searchParams.set("access_token", userAccessToken);

  const pagesRes = await fetch(pagesUrl.toString());
  const pagesRawText = await pagesRes.text();
  console.log(
    `[meta/oauth/callback] /me/accounts status=${pagesRes.status} body=${pagesRawText.slice(0, 500)}`
  );
  let pagesData: FacebookPagesResponse;
  try {
    pagesData = JSON.parse(pagesRawText) as FacebookPagesResponse;
  } catch {
    return NextResponse.json(
      { error: `Page listesi parse edilemedi: ${pagesRawText.slice(0, 200)}` },
      { status: 400 }
    );
  }
  if (!pagesRes.ok || pagesData.error) {
    const errMsg = pagesData.error?.message ?? "Page listesi alınamadı";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }

  let pages = pagesData.data ?? [];

  // FALLBACK: /me/accounts boş — page Business Manager altında ve uygulama o
  // BM'ye eklenmemiş olabilir. Bu durumda /me/businesses → owned/client pages
  // ile çekmeyi dene. business_management izni gerekmez; pages_show_list yeterli
  // ama bazı sayfalar yalnızca business asset olarak granted edilmişse bu yol
  // gerekiyor.
  if (pages.length === 0) {
    console.log("[meta/oauth/callback] /me/accounts boş, businesses fallback'e geçiliyor");
    type BusinessListResp = {
      data?: Array<{ id: string; name?: string }>;
      error?: FacebookErrorResponse["error"];
    };
    const bizUrl = new URL("https://graph.facebook.com/v19.0/me/businesses");
    bizUrl.searchParams.set("access_token", userAccessToken);
    bizUrl.searchParams.set("limit", "100");
    const bizRes = await fetch(bizUrl.toString());
    const bizText = await bizRes.text();
    console.log(`[meta/oauth/callback] /me/businesses status=${bizRes.status} body=${bizText.slice(0, 500)}`);
    const bizData = JSON.parse(bizText) as BusinessListResp;
    const businesses = bizData.data ?? [];

    const aggregated: NonNullable<FacebookPagesResponse["data"]> = [];
    for (const biz of businesses) {
      // Owned pages — ilgili business'ın doğrudan sahip olduğu sayfalar
      for (const path of ["owned_pages", "client_pages"] as const) {
        const u = new URL(`https://graph.facebook.com/v19.0/${biz.id}/${path}`);
        u.searchParams.set("fields", "id,name,access_token,category");
        u.searchParams.set("limit", "100");
        u.searchParams.set("access_token", userAccessToken);
        try {
          const r = await fetch(u.toString());
          const t = await r.text();
          console.log(`[meta/oauth/callback] /${biz.id}/${path} status=${r.status} body=${t.slice(0, 400)}`);
          const j = JSON.parse(t) as FacebookPagesResponse;
          if (j.data) {
            for (const p of j.data) {
              if (p.access_token && !aggregated.find((x) => x.id === p.id)) {
                aggregated.push(p);
              }
            }
          }
        } catch (e) {
          console.error(`[meta/oauth/callback] ${path} fetch error:`, e);
        }
      }
    }

    pages = aggregated;
    console.log(`[meta/oauth/callback] businesses fallback: ${aggregated.length} page bulundu`);
  }

  if (pages.length === 0) {
    const permsUrl = new URL("https://graph.facebook.com/v19.0/me/permissions");
    permsUrl.searchParams.set("access_token", userAccessToken);
    let permsDebug = "";
    try {
      const permsRes = await fetch(permsUrl.toString());
      permsDebug = await permsRes.text();
    } catch {
      permsDebug = "perms fetch failed";
    }
    return NextResponse.json(
      {
        error:
          "Facebook sayfası bulunamadı. Sayfanız Business Manager altındaysa, https://business.facebook.com → Ayarlar → Uygulamalar → Mevcut uygulama ekle ile AjansOS Publisher app ID (1272101664586614) eklemelisiniz. Veya kişisel profilinizden bir Page yönetiyorsanız OAuth sırasında onu da seçin.",
        debug: { perms: permsDebug.slice(0, 800), pagesBody: pagesRawText.slice(0, 500) },
      },
      { status: 400 }
    );
  }

  // ─── Adım 4: Her Page için FB + (varsa) IG kaydı ──────────────────────────
  const { prisma } = await import("@/lib/prisma");

  let savedFb = 0;
  let savedIg = 0;
  const errors: string[] = [];

  for (const page of pages) {
    const pageTokenEnc = encryptToken(page.access_token);
    // Page token genelde non-expiring — null bırakıyoruz; expire ederse refresh
    // mekanizması (re-auth) kullanıcı tarafında devreye girer.
    const fbExpiresAt: Date | null = null;

    // 4a) Facebook Page kaydı
    try {
      await prisma.socialAccount.upsert({
        where: {
          clientId_platform_accountId: {
            clientId,
            platform: "FACEBOOK",
            accountId: page.id,
          },
        },
        create: {
          clientId,
          platform: "FACEBOOK",
          accountId: page.id,
          accountName: page.name,
          accessTokenEnc: pageTokenEnc,
          tokenExpiresAt: fbExpiresAt,
          pageId: page.id,
        },
        update: {
          accountName: page.name,
          accessTokenEnc: pageTokenEnc,
          tokenExpiresAt: fbExpiresAt,
          pageId: page.id,
        },
      });
      savedFb++;
    } catch (e) {
      console.error(`[meta/oauth/callback] FB upsert error (page ${page.id}):`, e);
      errors.push(`FB Page ${page.name}: kayıt hatası`);
      continue;
    }

    // 4b) Bu Page'e bağlı bir IG Business hesabı var mı?
    const igCheckUrl = new URL(`https://graph.facebook.com/v19.0/${page.id}`);
    igCheckUrl.searchParams.set("fields", "instagram_business_account");
    igCheckUrl.searchParams.set("access_token", page.access_token);

    let igRes: Response;
    try {
      igRes = await fetch(igCheckUrl.toString());
    } catch (e) {
      console.error(`[meta/oauth/callback] IG check fetch failed (page ${page.id}):`, e);
      continue;
    }
    const igCheckData = (await igRes.json()) as InstagramAccountResponse;
    const igUserId = igCheckData.instagram_business_account?.id;
    if (!igUserId) continue; // Bu Page'e IG bağlı değil — sessiz geç

    // IG hesabının username/name'ini çek (UI'da gözükmesi için)
    const igDetailsUrl = new URL(`https://graph.facebook.com/v19.0/${igUserId}`);
    igDetailsUrl.searchParams.set("fields", "id,username,name,profile_picture_url");
    igDetailsUrl.searchParams.set("access_token", page.access_token);

    let igAccountName = igUserId;
    try {
      const igDetailsRes = await fetch(igDetailsUrl.toString());
      const igDetailsData = (await igDetailsRes.json()) as InstagramUserDetailsResponse;
      if (igDetailsRes.ok && !igDetailsData.error) {
        igAccountName =
          igDetailsData.username ?? igDetailsData.name ?? igUserId;
      }
    } catch {
      // Detay alınamadıysa ID ile kaydet, sonra kullanıcı yenileyebilir
    }

    // 4c) Instagram kaydı — page token'ı paylaşıyor (IG Graph API page token kullanır)
    try {
      await prisma.socialAccount.upsert({
        where: {
          clientId_platform_accountId: {
            clientId,
            platform: "INSTAGRAM",
            accountId: igUserId,
          },
        },
        create: {
          clientId,
          platform: "INSTAGRAM",
          accountId: igUserId,
          accountName: igAccountName,
          accessTokenEnc: pageTokenEnc,
          tokenExpiresAt: fbExpiresAt,
          pageId: page.id,
          instagramId: igUserId,
        },
        update: {
          accountName: igAccountName,
          accessTokenEnc: pageTokenEnc,
          tokenExpiresAt: fbExpiresAt,
          pageId: page.id,
          instagramId: igUserId,
        },
      });
      savedIg++;
    } catch (e) {
      console.error(`[meta/oauth/callback] IG upsert error (ig ${igUserId}):`, e);
      errors.push(`IG @${igAccountName}: kayıt hatası`);
    }
  }

  // İlk OAuth'tan kalan eski kayıt (user-id'li FB) varsa kaldır — artık page-id'li
  // kayıtlar var. Bu, V1'de yanlış accountId ile yazılmış satırı temizler.
  // user.id formatında kaydedilmişti; pages içinde page.id'ler var; user.id
  // pages.id'lerden farklı olduğu için silinir.
  try {
    const meUrl = new URL("https://graph.facebook.com/v19.0/me");
    meUrl.searchParams.set("fields", "id");
    meUrl.searchParams.set("access_token", userAccessToken);
    const meRes = await fetch(meUrl.toString());
    const meData = (await meRes.json()) as { id?: string };
    if (meData.id) {
      await prisma.socialAccount
        .deleteMany({
          where: {
            clientId,
            platform: "FACEBOOK",
            accountId: meData.id,
            pageId: null,
          },
        })
        .catch(() => {});
    }
  } catch {
    // Önemli değil — temizlenemediyse user gözardı eder
  }

  // ignored: kullanıcı user token'ını saklamak isteyebilir ama publish için lazım
  // değil — page token'ları yeterli. user token sadece pages list almak için kullanıldı.
  void userTokenExpiresIn;

  console.log(
    `[meta/oauth/callback] clientId=${clientId} fb=${savedFb} ig=${savedIg} errors=${errors.length}`
  );

  // ─── Adım 5: Müşteri sayfasına geri dön ──────────────────────────────────
  const redirectUrl = new URL(`${appUrl}/musteriler/${clientId}`);
  redirectUrl.searchParams.set("meta_connected", "1");
  redirectUrl.searchParams.set("fb", String(savedFb));
  redirectUrl.searchParams.set("ig", String(savedIg));
  if (errors.length > 0) {
    redirectUrl.searchParams.set("warn", errors.slice(0, 3).join("|"));
  }
  return NextResponse.redirect(redirectUrl.toString());
}

/**
 * TikTok OAuth callback: code → access+refresh → user info → DB.
 *
 * Adımlar:
 *  1. POST /v2/oauth/token/ ile code'u access_token + refresh_token'a çevir
 *  2. GET /v2/user/info/ ile open_id ve display_name al (open_id publish API'nin
 *     hedef kullanıcı anahtarı — bunu accountId olarak kaydediyoruz)
 *  3. Token'ı `access|refresh` formatında şifrele
 *
 * TikTok access_token TTL: 24 saat. Refresh_token TTL: 365 gün. Refresh
 * mekanizması publish helper'da (401 → refresh → retry). TikTok refresh_token'ı
 * her refresh'te yenileyebilir — v2 endpoint'i yeni refresh_token da dönüyor;
 * MVP'de ilk aldığımızı kullanıyoruz, sonraki refresh'te de aynı kalır (genelde).
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface TikTokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const clientId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const desc = searchParams.get("error_description") ?? "OAuth reddedildi";
    return NextResponse.json({ error: desc }, { status: 400 });
  }
  if (!code || !clientId) {
    return NextResponse.json({ error: "code veya state eksik" }, { status: 400 });
  }

  const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
  const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!tiktokClientKey || !tiktokClientSecret || !appUrl) {
    return NextResponse.json(
      { error: "TikTok env değişkenleri tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/tiktok/oauth/callback`;

  // 1) Token takası
  const tokenParams = new URLSearchParams({
    client_key: tiktokClientKey,
    client_secret: tiktokClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = (await tokenRes.json()) as TikTokTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json(
      { error: tokenData.error_description ?? tokenData.error ?? "Token alınamadı" },
      { status: 400 }
    );
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? null;
  const expiresIn = tokenData.expires_in;
  const openIdFromToken = tokenData.open_id;

  // 2) User info (display_name için)
  const infoUrl = new URL("https://open.tiktokapis.com/v2/user/info/");
  infoUrl.searchParams.set("fields", "open_id,union_id,avatar_url,display_name");

  const infoRes = await fetch(infoUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const infoData = (await infoRes.json()) as TikTokUserInfoResponse;

  const openId = infoData.data?.user?.open_id ?? openIdFromToken;
  if (!openId) {
    return NextResponse.json(
      {
        error:
          infoData.error?.message ?? "TikTok open_id alınamadı",
      },
      { status: 400 }
    );
  }
  const displayName = infoData.data?.user?.display_name ?? openId;

  // 3) Token şifrele
  const combinedToken = refreshToken ? `${accessToken}|${refreshToken}` : accessToken;
  const accessTokenEnc = encryptToken(combinedToken);
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  // 4) DB upsert
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.socialAccount.upsert({
      where: {
        clientId_platform_accountId: {
          clientId,
          platform: "TIKTOK",
          accountId: openId,
        },
      },
      create: {
        clientId,
        platform: "TIKTOK",
        accountId: openId,
        accountName: displayName,
        accessTokenEnc,
        tokenExpiresAt,
      },
      update: {
        accountName: displayName,
        accessTokenEnc,
        tokenExpiresAt,
      },
    });
  } catch (e) {
    console.error("[tiktok/oauth/callback] DB error:", e);
    return NextResponse.json({ error: "DB yazımı başarısız" }, { status: 500 });
  }

  return NextResponse.redirect(`${appUrl}/musteriler/${clientId}`);
}

/**
 * Google/YouTube OAuth callback: code → access+refresh → channel info → DB.
 *
 * Adımlar:
 *  1. Code'u token'a takas (POST https://oauth2.googleapis.com/token)
 *  2. YouTube Data API v3: GET /youtube/v3/channels?part=snippet&mine=true
 *     İlk channel'ın id/title değerlerini accountId/accountName olarak kaydet
 *  3. Token'ı `access|refresh` formatında birleştirip şifrele
 *
 * Kanalı olmayan kullanıcılar (sadece watch account) — channel listesi boş dönerse
 * callback hata verir ("YouTube kanalı bulunamadı"). Ajans kanal oluşturduktan
 * sonra tekrar denesin.
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface YoutubeChannelListResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      thumbnails?: {
        default?: { url?: string };
      };
    };
  }>;
  error?: { code: number; message: string };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const clientId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `OAuth reddedildi: ${error}` }, { status: 400 });
  }
  if (!code || !clientId) {
    return NextResponse.json({ error: "code veya state eksik" }, { status: 400 });
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!googleClientId || !googleClientSecret || !appUrl) {
    return NextResponse.json(
      { error: "Google env değişkenleri tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/youtube/oauth/callback`;

  // 1) Token takası
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: googleClientId,
    client_secret: googleClientSecret,
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json(
      { error: tokenData.error_description ?? "Token alınamadı" },
      { status: 400 }
    );
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? null;
  const expiresIn = tokenData.expires_in;

  // 2) Kanal bilgisi
  const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelsUrl.searchParams.set("part", "snippet");
  channelsUrl.searchParams.set("mine", "true");

  const channelsRes = await fetch(channelsUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelsData = (await channelsRes.json()) as YoutubeChannelListResponse;
  if (!channelsRes.ok || channelsData.error) {
    return NextResponse.json(
      { error: channelsData.error?.message ?? "Kanal bilgisi alınamadı" },
      { status: 400 }
    );
  }
  const channel = channelsData.items?.[0];
  if (!channel) {
    return NextResponse.json(
      { error: "YouTube kanalı bulunamadı. Önce bir kanal oluşturun, sonra tekrar bağlayın." },
      { status: 400 }
    );
  }

  const accountId = channel.id;
  const accountName = channel.snippet?.title ?? accountId;

  // 3) Token şifrele (refresh varsa `access|refresh` formatı)
  if (!refreshToken) {
    // Refresh gelmediyse genelde aynı hesap daha önce onaylamış demektir —
    // Google panelinden ayırıp tekrar denemesi gerek, çünkü 1 saat sonra expire olur.
    return NextResponse.json(
      {
        error:
          "Google refresh_token göndermedi. https://myaccount.google.com/permissions üzerinden uygulamanın erişimini kaldırıp tekrar bağlayın.",
      },
      { status: 400 }
    );
  }
  const combinedToken = `${accessToken}|${refreshToken}`;
  const accessTokenEnc = encryptToken(combinedToken);
  const tokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

  // 4) DB upsert
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.socialAccount.upsert({
      where: {
        clientId_platform_accountId: {
          clientId,
          platform: "YOUTUBE",
          accountId,
        },
      },
      create: {
        clientId,
        platform: "YOUTUBE",
        accountId,
        accountName,
        accessTokenEnc,
        tokenExpiresAt,
      },
      update: {
        accountName,
        accessTokenEnc,
        tokenExpiresAt,
      },
    });
  } catch (e) {
    console.error("[youtube/oauth/callback] DB error:", e);
    return NextResponse.json({ error: "DB yazımı başarısız" }, { status: 500 });
  }

  return NextResponse.redirect(`${appUrl}/musteriler/${clientId}`);
}

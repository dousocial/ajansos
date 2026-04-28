/**
 * LinkedIn OAuth callback: authorization code → access_token → userinfo → DB.
 *
 * Adımlar:
 *  1. Code'u access_token'a çevir (POST /oauth/v2/accessToken)
 *  2. /v2/userinfo ile sub (kişi ID'si) ve name al (OIDC claims)
 *  3. accountId = "urn:li:person:{sub}" — publish fonksiyonunda doğrudan author
 *     URN olarak kullanılıyor
 *  4. Token'ı AES-GCM ile şifrele, SocialAccount upsert
 *
 * LinkedIn access token TTL: 60 gün. Refresh token opt-in (sadece Marketing
 * Developer Platform onayı olanlarda). MVP'de refresh yok — 60 günde bir
 * yeniden bağlan.
 */

import { NextRequest, NextResponse } from "next/server";
import { encryptToken } from "@/lib/crypto";

export const runtime = "nodejs";

interface LinkedInTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface LinkedInUserInfoResponse {
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  error?: string;
  error_description?: string;
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

  const liClientId = process.env.LINKEDIN_CLIENT_ID;
  const liClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!liClientId || !liClientSecret || !appUrl) {
    return NextResponse.json(
      { error: "LinkedIn env değişkenleri tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/linkedin/oauth/callback`;

  // 1) Token takası
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: liClientId,
    client_secret: liClientSecret,
  });
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });
  const tokenData = (await tokenRes.json()) as LinkedInTokenResponse;
  if (!tokenRes.ok || !tokenData.access_token) {
    return NextResponse.json(
      { error: tokenData.error_description ?? "Token alınamadı" },
      { status: 400 }
    );
  }

  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token ?? null;
  const expiresIn = tokenData.expires_in;

  // 2) Userinfo ile sub + name
  const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const infoData = (await infoRes.json()) as LinkedInUserInfoResponse;
  if (!infoRes.ok || !infoData.sub) {
    return NextResponse.json(
      { error: infoData.error_description ?? "Kullanıcı bilgisi alınamadı" },
      { status: 400 }
    );
  }

  const accountId = `urn:li:person:${infoData.sub}`;
  const accountName = infoData.name ?? infoData.email ?? infoData.sub;

  // 3) Token şifrele (refresh varsa `access|refresh` formatı)
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
          platform: "LINKEDIN",
          accountId,
        },
      },
      create: {
        clientId,
        platform: "LINKEDIN",
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
    console.error("[linkedin/oauth/callback] DB error:", e);
    return NextResponse.json({ error: "DB yazımı başarısız" }, { status: 500 });
  }

  return NextResponse.redirect(`${appUrl}/musteriler/${clientId}`);
}

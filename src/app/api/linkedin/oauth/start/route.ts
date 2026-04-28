/**
 * LinkedIn OAuth 2.0 başlatıcı (Authorization Code flow).
 *
 * Akış: /start?clientId=xxx → LinkedIn authorize ekranı → callback
 * State=clientId: Callback'te hangi müşteriye bağlanacağımızı biliyoruz
 * (CSRF için ayrıca session cookie'si ile eşleştirilebilir, MVP'de atlandı).
 *
 * Scope:
 *  - openid, profile, email — kişisel profil tanımlaması
 *  - w_member_social — profilde paylaşım atabilmek (/v2/ugcPosts)
 *
 * Şirket sayfası için `w_organization_social` ve farklı author URN gerekir —
 * MVP kişisel profil. LinkedIn developer panelinde app'in "Sign In with LinkedIn
 * using OpenID Connect" + "Share on LinkedIn" ürünlerine başvuru yapılmalı.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ error: "clientId query parameter is required" }, { status: 400 });
  }

  const liClientId = process.env.LINKEDIN_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!liClientId || !appUrl) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID veya NEXT_PUBLIC_APP_URL tanımlı değil" },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl}/api/linkedin/oauth/callback`;
  const scope = ["openid", "profile", "email", "w_member_social"].join(" ");

  const oauthUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("client_id", liClientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("scope", scope);
  oauthUrl.searchParams.set("state", clientId);

  return NextResponse.redirect(oauthUrl.toString());
}

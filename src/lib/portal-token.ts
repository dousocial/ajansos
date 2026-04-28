import { SignJWT, jwtVerify } from "jose";

// Portal önizleme JWT'si — ADMIN/TEAM kullanıcılarının müşteri portalını salt-okunur
// modda görmesini sağlar. Onay/revizyon aksiyonları için geçerli değildir; sadece
// portal listeleme endpoint'i bu token'ı kabul eder.

const PORTAL_TOKEN_KIND = "portal-preview";
const DEFAULT_EXPIRY = "24h";

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error("AUTH_SECRET environment değişkeni tanımlı değil");
  }
  return new TextEncoder().encode(raw);
}

export async function signPortalToken(
  clientId: string,
  issuerUserId: string,
  expiry: string = DEFAULT_EXPIRY
): Promise<string> {
  return await new SignJWT({
    clientId,
    kind: PORTAL_TOKEN_KIND,
    iss: issuerUserId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getSecret());
}

export async function verifyPortalToken(
  token: string
): Promise<{ clientId: string; issuerUserId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.kind !== PORTAL_TOKEN_KIND) return null;
    if (typeof payload.clientId !== "string") return null;
    if (typeof payload.iss !== "string") return null;
    return { clientId: payload.clientId, issuerUserId: payload.iss };
  } catch {
    return null;
  }
}

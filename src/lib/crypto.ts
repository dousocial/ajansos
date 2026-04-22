import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getValidatedKey(): Buffer {
  const rawKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!rawKey || rawKey.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string");
  }
  return Buffer.from(rawKey, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getValidatedKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(":");
}

export function decryptToken(ciphertext: string): string {
  const key = getValidatedKey();
  const [ivHex, encHex, tagHex] = ciphertext.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}

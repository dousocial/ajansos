import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

// Test öncesi key set edilmeli — modül import'undan ÖNCE.
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
});

describe("crypto", () => {
  it("encrypts and decrypts back to original plaintext", async () => {
    const { encryptToken, decryptToken } = await import("./crypto");
    const plain = "ya29.a0ARrdaM-very-long-secret-token";
    const enc = encryptToken(plain);
    expect(enc).not.toContain(plain);
    expect(enc.split(":").length).toBe(3); // iv:enc:tag
    expect(decryptToken(enc)).toBe(plain);
  });

  it("produces different ciphertexts for same plaintext (random IV)", async () => {
    const { encryptToken } = await import("./crypto");
    const plain = "same-input";
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt tampered ciphertext (auth tag check)", async () => {
    const { encryptToken, decryptToken } = await import("./crypto");
    const enc = encryptToken("hello");
    const [iv, ct, tag] = enc.split(":");
    // tag'in son karakterini değiştir
    const tampered = `${iv}:${ct}:${tag.slice(0, -2)}${tag.slice(-2) === "00" ? "11" : "00"}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws when TOKEN_ENCRYPTION_KEY is invalid length", async () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "short";
    // Re-import değil, fonksiyonlar her çağrıda env okuyor.
    const { encryptToken } = await import("./crypto");
    expect(() => encryptToken("x")).toThrow(/64-character hex/);
    process.env.TOKEN_ENCRYPTION_KEY = original;
  });
});

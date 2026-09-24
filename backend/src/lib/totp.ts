import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * TOTP (RFC 6238) — Google Authenticator, Microsoft Authenticator, 1Password və
 * s. ilə uyğun: HMAC-SHA1, 6 rəqəm, 30 saniyəlik addım. Kitabxana əvəzinə
 * `node:crypto` işlədilir; alqoritm qısadır və RFC test vektorları ilə yoxlanır.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    const index = BASE32.indexOf(character);
    if (index === -1) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bit — RFC 4226-nın tövsiyə etdiyi uzunluq. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function currentTotpStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac.readUInt8(hmac.length - 1) & 15;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Kodu ±1 addım (saat fərqi üçün) yoxlayır və uyğun gələn addımı qaytarır.
 * `lastUsedStep`-dən köhnə və ya ona bərabər addım qəbul edilmir — eyni kod
 * ikinci dəfə işlənə bilməz (təkrar hücum).
 */
export function verifyTotp(secret: string, code: string, lastUsedStep: number | null, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = currentTotpStep(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

export function totpUri(secret: string, accountEmail: string) {
  const issuer = "EduRate";
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/**
 * Sirr bazada açıq saxlanmır: AES-256-GCM, açar `JWT_SECRET`-dən HKDF ilə
 * törədilir (ayrıca mühit dəyişəni tələb etmir). Qeyd: `JWT_SECRET` dəyişsə
 * mövcud 2FA sirləri oxunmaz olur — istifadəçi bərpa kodu ilə daxil olub 2FA-nı
 * yenidən qurmalıdır.
 */
function encryptionKey() {
  return Buffer.from(hkdfSync("sha256", env.JWT_SECRET, "edurate-2fa", "totp-secret-v1", 32));
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** 10 birdəfəlik bərpa kodu, "xxxxx-xxxxx" formatında (qarışdırılan simvollar yoxdur). */
export function generateRecoveryCodes(count = 10) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(.{5})(.{5})$/, "$1-$2");
}

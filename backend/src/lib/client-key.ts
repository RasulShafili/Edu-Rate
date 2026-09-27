import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";

/**
 * Brauzer backend-ə birbaşa yox, Vercel BFF-i üzərindən gəlir. Ona görə
 * `request.ip` hər istifadəçi üçün Vercel-in ünvanıdır və IP limitləri bütün
 * sayt üçün ortaq olurdu: 15 dəqiqədə ~10 girişdən sonra hamı bloklanırdı.
 *
 * BFF istifadəçinin real IP-sini ortaq sirlə birlikdə göndərir. Backend ictimai
 * ünvanda olduğu üçün başlığa yalnız sirr düz gələndə inanılır — əks halda
 * hücumçu hər sorğuda başqa IP yazıb limitləri keçərdi.
 */
export function trustedClientIp(request: Request): string | undefined {
  const secret = env.EDURATE_PROXY_SECRET;
  if (!secret) return undefined;
  const supplied = Buffer.from(request.header("x-edurate-proxy-secret") ?? "");
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined;
  const ip = request.header("x-edurate-client-ip")?.trim() ?? "";
  return isIP(ip) ? ip : undefined;
}

/** İstifadəçinin real IP-si (etibarlı BFF-dən), yoxsa bağlantının IP-si. */
export function clientIp(request: Request) {
  return trustedClientIp(request) ?? request.ip ?? "";
}

/** Anonim sorğular üçün limit açarı. */
export function clientIpKey(request: Request) {
  return ipKeyGenerator(clientIp(request) || "unknown");
}

/**
 * Daxil olmuş istifadəçinin limiti hesabına bağlıdır — IP-yə yox. Limiter
 * `authenticate`-dən SONRA gəlməlidir, yoxsa `request.auth` hələ boşdur.
 */
export function userOrIpKey(request: Request) {
  return request.auth?.userId ? `user:${request.auth.userId}` : clientIpKey(request);
}

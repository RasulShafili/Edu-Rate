import { env } from "../config/env.js";

/**
 * E-poçtla 6 rəqəmli giriş və qeydiyyat kodu.
 *
 * Şifrə düzgün olsa belə sessiya dərhal verilmir: hesabın e-poçtuna kod gedir
 * və yalnız kod daxil ediləndən sonra daxil olmaq mümkündür. Qeydiyyatda da eyni
 * addım var — başqasının Gmail ünvanı ilə hesab açıb istifadə etmək olmur.
 *
 * `enabled` iş vaxtı dəyişdirilə bilir: testlər onu ayrıca açır, poçt birdən
 * sıradan çıxsa Render-də `EMAIL_LOGIN_CODE=false` girişi köhnə qaydaya qaytarır.
 */
export const loginCodeSettings = {
  enabled: env.EMAIL_LOGIN_CODE && env.NODE_ENV !== "test",
};

export const LOGIN_CODE_TTL_MS = 10 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_SENDS_PER_CHALLENGE = 5;

/** "rasul.shafili@gmail.com" → "r***i@gmail.com": hansı ünvana getdiyini göstərir, tam açmır. */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : `${local[0]}***${local[local.length - 1]}`;
  return `${visible}${local.length <= 2 ? "***" : ""}@${domain}`;
}

/*
 * Göndərmə sayğacları: server tək nüsxədir (Render), ona görə yaddaş kifayətdir.
 * Sayğac itsə (yenidən başlama) ən pis halda bir kod artıq göndərilir.
 */
const lastSentByUser = new Map<string, number>();
const sendsByChallenge = new Map<string, number>();

export function resendWaitSeconds(userId: string) {
  const last = lastSentByUser.get(userId) ?? 0;
  const wait = last + RESEND_COOLDOWN_MS - Date.now();
  return wait > 0 ? Math.ceil(wait / 1000) : 0;
}

export function noteCodeSent(userId: string, challengeId?: string) {
  lastSentByUser.set(userId, Date.now());
  if (challengeId) sendsByChallenge.set(challengeId, (sendsByChallenge.get(challengeId) ?? 0) + 1);
  if (lastSentByUser.size > 5000) lastSentByUser.clear();
  if (sendsByChallenge.size > 5000) sendsByChallenge.clear();
}

export function sendsForChallenge(challengeId: string) {
  return sendsByChallenge.get(challengeId) ?? 0;
}

/** Yalnız testlər üçün: sayğacları sıfırlayır. */
export function resetLoginCodeCounters() {
  lastSentByUser.clear();
  sendsByChallenge.clear();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

/** Kod məktublarının ortaq şablonu (şifrə bərpası, giriş, e-poçt təsdiqi). */
export function codeEmailHtml(input: { name: string; code: string; title: string; heading: string; lead: string; instruction: string; label: string; note: string }) {
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.title)}</title></head><body style="margin:0;padding:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17332d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border:1px solid #d8e5df;border-radius:24px;background:#ffffff;box-shadow:0 18px 55px rgba(24,73,62,.12)"><tr><td style="padding:30px 34px;background:linear-gradient(135deg,#123c33,#2d7968);color:#ffffff"><div style="font-size:12px;font-weight:800;letter-spacing:3px">EDURATE</div><h1 style="margin:34px 0 8px;font-size:32px;line-height:1.08">${escapeHtml(input.heading)}</h1><p style="margin:0;color:#d9eee7;font-size:14px;line-height:1.6">${escapeHtml(input.lead)}</p></td></tr><tr><td style="padding:34px"><p style="margin:0 0 12px;font-size:16px">Salam, <strong>${escapeHtml(input.name)}</strong></p><p style="margin:0 0 26px;color:#5c716b;font-size:14px;line-height:1.7">${escapeHtml(input.instruction)}</p><div style="padding:22px 14px;text-align:center;border:1px solid #dce9e4;border-radius:16px;background:#f4f8f6"><div style="margin-bottom:8px;color:#668078;font-size:10px;font-weight:800;letter-spacing:2px">${escapeHtml(input.label)}</div><div style="color:#1f6657;font-size:38px;font-weight:800;letter-spacing:10px">${input.code}</div></div><p style="margin:22px 0 0;color:#5c716b;font-size:13px;line-height:1.65">Kod <strong>10 dəqiqə</strong> qüvvədədir və yalnız bir dəfə istifadə oluna bilər.</p><p style="margin:14px 0 0;color:#879a94;font-size:12px;line-height:1.6">${escapeHtml(input.note)}</p></td></tr><tr><td style="padding:18px 34px;border-top:1px solid #e5ede9;color:#8a9b96;font-size:11px">EduRate · Müstəqil tələbə pilot platforması</td></tr></table></td></tr></table></body></html>`;
}

export function loginCodeEmail(name: string, code: string) {
  return {
    subject: `EduRate • Giriş kodunuz: ${code}`,
    html: codeEmailHtml({
      name,
      code,
      title: "EduRate giriş kodu",
      heading: "Hesabınıza giriş.",
      lead: "Şifrəniz düzgün daxil edildi. Girişi tamamlamaq üçün kodu təsdiqləyin.",
      instruction: "Aşağıdakı 6 rəqəmli kodu EduRate giriş səhifəsinə daxil edin.",
      label: "GİRİŞ KODU",
      note: "Bu girişi siz etməmisinizsə, kodu heç kimlə paylaşmayın və dərhal şifrənizi dəyişin — kimsə şifrənizi bilir.",
    }),
  };
}

export function signupCodeEmail(name: string, code: string) {
  return {
    subject: `EduRate • E-poçt təsdiq kodunuz: ${code}`,
    html: codeEmailHtml({
      name,
      code,
      title: "EduRate e-poçt təsdiqi",
      heading: "E-poçtunuzu təsdiqləyin.",
      lead: "EduRate hesabınız yaradıldı. Bu ünvanın sizə məxsus olduğunu təsdiqləyin.",
      instruction: "Qeydiyyatı tamamlamaq üçün aşağıdakı 6 rəqəmli kodu EduRate səhifəsinə daxil edin.",
      label: "TƏSDİQ KODU",
      note: "Bu qeydiyyatı siz etməmisinizsə, məktubu nəzərə almayın — kod olmadan hesab aktivləşmir.",
    }),
  };
}

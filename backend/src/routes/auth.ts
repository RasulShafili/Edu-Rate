import { randomUUID } from "node:crypto";
import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
  markEmailVerified,
  updatePassword,
  deleteUser,
  type UserRecord,
} from "../db/database.js";
import {
  ACADEMIC_UNIVERSITY,
  isAcademicFaculty,
  isValidAcademicSelection,
} from "../data/academic-catalog.js";
import { ApiError } from "../lib/api-error.js";
import {
  createAccessToken,
  hashPassword,
  toPublicUser,
  verifyPassword,
} from "../lib/auth.js";
import { authenticate } from "../middleware/authenticate.js";
import { deactivateProfessionalProfilesForUser, synchronizeProfessionalProfilesForUser } from "../db/professionals.js";
import {
  clearAttempts,
  consumeActionCode,
  consumeActionToken,
  consumeLoginChallenge,
  consumeRecoveryCode,
  countRecoveryCodes,
  createActionCode,
  createActionToken,
  createLoginChallenge,
  deleteTwoFactor,
  findLoginChallenge,
  getLockRemainingSeconds,
  getTwoFactor,
  isTwoFactorEnabled,
  listSessions,
  markTwoFactorStepUsed,
  registerFailedAttempt,
  registerSessionToken,
  replaceRecoveryCodes,
  revokeAllSessions,
  revokeSession,
  savePendingTwoFactor,
} from "../db/auth-security.js";
import { findPasswordProblem, type PasswordProblem } from "../lib/password-policy.js";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  normalizeRecoveryCode,
  totpUri,
  verifyTotp,
} from "../lib/totp.js";
import { accountActionUrl, EmailDeliveryError, sendAccountEmail } from "../lib/email.js";
import { env } from "../config/env.js";
import { clientIp, clientIpKey } from "../lib/client-key.js";

export const authRouter = Router();

const signupLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  keyGenerator: clientIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Çox sayda qeydiyyat cəhdi edildi." } },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: clientIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Çox sayda giriş cəhdi edildi." } },
});

/*
 * IP limitləri (`loginLimiter`) Vercel BFF-in arxasında bütün istifadəçilər
 * üçün ortaq ünvanı sayır, BFF-in öz sayğacı isə serverless nüsxənin
 * yaddaşındadır. Ona görə uğursuz cəhdlər həm də HESAB üzrə, bazada sayılır.
 */
const LOGIN_ATTEMPTS = { limit: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
const TWO_FACTOR_ATTEMPTS = { limit: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
const RESET_CODE_ATTEMPTS = { limit: 5, windowMs: 15 * 60_000, lockMs: 30 * 60_000 };

function accountThrottled(seconds: number) {
  return new ApiError(
    429,
    "ACCOUNT_THROTTLED",
    `Bu hesab üçün çox sayda uğursuz cəhd edildi. ${Math.ceil(seconds / 60)} dəqiqə sonra yenidən yoxla.`,
    { retryAfter: String(seconds) },
  );
}

const PASSWORD_PROBLEM_MESSAGES: Record<PasswordProblem, string> = {
  tooShort: "Şifrə ən az 10 simvol olmalıdır.",
  tooLong: "Şifrə çox uzundur.",
  needsLetter: "Şifrədə hərf olmalıdır.",
  needsDigit: "Şifrədə rəqəm olmalıdır.",
  common: "Bu şifrə çox yayılmışdır və asan tapılır.",
  personal: "Şifrədə adın və ya e-poçtun olmamalıdır.",
  repetitive: "Şifrə təkrarlanan və ya ardıcıl simvollardan ibarətdir.",
};

function assertStrongPassword(password: string, context: { email?: string; name?: string } = {}) {
  const problem = findPasswordProblem(password, context);
  if (problem) {
    throw new ApiError(422, "WEAK_PASSWORD", PASSWORD_PROBLEM_MESSAGES[problem], {
      password: PASSWORD_PROBLEM_MESSAGES[problem],
      reason: problem,
    });
  }
}

/** Mövcud olmayan e-poçt üçün də bcrypt işləsin: cavab vaxtı hesabın varlığını açmasın. */
let dummyPasswordHash: Promise<string> | null = null;
function verifyAgainstDummy(password: string) {
  dummyPasswordHash ??= hashPassword(randomUUID());
  return dummyPasswordHash.then((hash) => verifyPassword(password, hash));
}

async function publicUserWithSecurity(user: UserRecord) {
  return { ...toPublicUser(user), twoFactorEnabled: await isTwoFactorEnabled(user.id) };
}

/** Şifrəni yenidən yoxlayır (2FA idarəsi); uğursuz cəhdlər girişlə eyni sayğacdadır. */
async function assertCurrentPassword(user: UserRecord, password: string) {
  const key = `login:${user.email}`;
  const locked = await getLockRemainingSeconds(key);
  if (locked) throw accountThrottled(locked);
  if (!(await verifyPassword(password, user.passwordHash))) {
    const lockedNow = await registerFailedAttempt(key, LOGIN_ATTEMPTS);
    if (lockedNow) throw accountThrottled(lockedNow);
    throw new ApiError(401, "INVALID_CREDENTIALS", "Şifrə düzgün deyil.");
  }
}

/** TOTP kodu və ya birdəfəlik bərpa kodu. Qaytarır: işlənən üsul, yoxsa `null`. */
async function verifySecondFactor(userId: string, rawCode: string): Promise<"totp" | "recovery" | null> {
  const code = rawCode.replace(/\s/g, "");
  if (/^\d{6}$/.test(code)) {
    const record = await getTwoFactor(userId);
    if (!record?.enabledAt) return null;
    const step = verifyTotp(decryptSecret(record.secretEncrypted), code, record.lastUsedStep);
    if (step === null) return null;
    return (await markTwoFactorStepUsed(userId, step)) ? "totp" : null;
  }
  return (await consumeRecoveryCode(userId, normalizeRecoveryCode(code))) ? "recovery" : null;
}

async function assertSecondFactor(userId: string, code: string) {
  const key = `2fa:${userId}`;
  const locked = await getLockRemainingSeconds(key);
  if (locked) throw accountThrottled(locked);
  const method = await verifySecondFactor(userId, code);
  if (!method) {
    const lockedNow = await registerFailedAttempt(key, TWO_FACTOR_ATTEMPTS);
    if (lockedNow) throw accountThrottled(lockedNow);
    throw new ApiError(401, "TWO_FACTOR_INVALID", "Kod yanlışdır və ya vaxtı keçib.");
  }
  await clearAttempts(key);
  return method;
}

const signupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  // Qaydalar `assertStrongPassword`-dadır (frontend ilə eyni fayl).
  password: z.string().max(200),
  university: z.string().trim().min(2).max(180).default(ACADEMIC_UNIVERSITY),
  accountType: z.enum(["student", "teacher"]).default("student"),
  faculty: z.string().trim().max(180).optional().default(""),
  program: z.string().trim().min(2).max(180),
  legalAccepted: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});
const emailSchema=z.object({email:z.email().transform((value)=>value.toLowerCase())}).strict();
const tokenSchema=z.object({token:z.string().min(32).max(256)}).strict();
const resetCodeSchema=z.object({
  email:z.email().transform((value)=>value.toLowerCase()),
  code:z.string().regex(/^\d{6}$/,"Bərpa kodu 6 rəqəmdən ibarət olmalıdır."),
}).strict();
const resetSchema=z.object({
  resetToken:z.string().min(32).max(256),
  password:z.string().max(200),
  passwordConfirm:z.string().max(200),
}).strict().refine((input)=>input.password===input.passwordConfirm,{path:["passwordConfirm"],message:"Şifrələr eyni deyil."});

async function issueSession(user:UserRecord,request:Request){
  const sessionId=randomUUID();const token=createAccessToken(user,sessionId);
  await registerSessionToken(user.id,token,sessionId,request.get("user-agent")??"",clientIp(request));
  return token;
}

async function sendVerification(user:{id:string;email:string;name:string}){
  const token=await createActionToken(user.id,"verify_email",24*60*60*1000);
  const url=accountActionUrl("/auth/verify",token);
  await sendAccountEmail({to:user.email,subject:"EduRate e-poçt təsdiqi",html:`<p>Salam ${escapeHtml(user.name)},</p><p>EduRate hesabını təsdiqləmək üçün aşağıdakı keçiddən istifadə et.</p><p><a href="${url}">E-poçtu təsdiqlə</a></p><p>Keçid 24 saat qüvvədədir.</p>`});
}

async function trySendVerification(user:{id:string;email:string;name:string}){
  try {
    await sendVerification(user);
    return true;
  } catch (error) {
    if (error instanceof EmailDeliveryError) return false;
    throw error;
  }
}

function escapeHtml(value:string){return value.replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]!));}

function passwordResetEmailHtml(name:string,code:string){
  return `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>EduRate bərpa kodu</title></head><body style="margin:0;padding:0;background:#eef4f1;font-family:Arial,Helvetica,sans-serif;color:#17332d"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;overflow:hidden;border:1px solid #d8e5df;border-radius:24px;background:#ffffff;box-shadow:0 18px 55px rgba(24,73,62,.12)"><tr><td style="padding:30px 34px;background:linear-gradient(135deg,#123c33,#2d7968);color:#ffffff"><div style="font-size:12px;font-weight:800;letter-spacing:3px">EDURATE</div><h1 style="margin:34px 0 8px;font-size:32px;line-height:1.08">Şifrənizi təhlükəsiz yeniləyin.</h1><p style="margin:0;color:#d9eee7;font-size:14px;line-height:1.6">Hesabınıza qayıtmaq üçün birdəfəlik kodunuz hazırdır.</p></td></tr><tr><td style="padding:34px"><p style="margin:0 0 12px;font-size:16px">Salam, <strong>${escapeHtml(name)}</strong></p><p style="margin:0 0 26px;color:#5c716b;font-size:14px;line-height:1.7">Aşağıdakı 6 rəqəmli kodu EduRate şifrə bərpası səhifəsinə daxil edin.</p><div style="padding:22px 14px;text-align:center;border:1px solid #dce9e4;border-radius:16px;background:#f4f8f6"><div style="margin-bottom:8px;color:#668078;font-size:10px;font-weight:800;letter-spacing:2px">BƏRPA KODU</div><div style="color:#1f6657;font-size:38px;font-weight:800;letter-spacing:10px">${code}</div></div><p style="margin:22px 0 0;color:#5c716b;font-size:13px;line-height:1.65">Kod <strong>10 dəqiqə</strong> qüvvədədir və yalnız bir dəfə istifadə oluna bilər.</p><p style="margin:14px 0 0;color:#879a94;font-size:12px;line-height:1.6">Bu sorğunu siz etməmisinizsə, məktubu nəzərə almayın və kodu heç kimlə paylaşmayın.</p></td></tr><tr><td style="padding:18px 34px;border-top:1px solid #e5ede9;color:#8a9b96;font-size:11px">EduRate · Müstəqil tələbə pilot platforması</td></tr></table></td></tr></table></body></html>`;
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  university: z.string().trim().min(2).max(180),
  faculty: z.string().trim().min(2).max(180),
  program: z.string().trim().min(2).max(180),
  year: z.string().trim().min(1).max(80),
  about: z.string().trim().max(600),
});

function academicSelectionErrorDetails(
  university: string,
  faculty: string,
): Record<string, string> {
  if (university !== ACADEMIC_UNIVERSITY) {
    return { university: `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.` };
  }

  if (!isAcademicFaculty(faculty)) {
    return { faculty: "Fakültəni təqdim olunan rəsmi siyahıdan seçin." };
  }

  return { program: "İxtisası seçilmiş fakültənin siyahısından seçin." };
}

authRouter.post("/signup", signupLimiter, async (request, response) => {
  const input = signupSchema.parse(request.body);
  assertStrongPassword(input.password, { email: input.email, name: input.name });
  if (env.NODE_ENV !== "test" && input.legalAccepted !== true) {
    throw new ApiError(422, "LEGAL_CONSENT_REQUIRED", "İstifadə şərtləri və məxfilik siyasəti qəbul edilməlidir.");
  }

  if (input.accountType === "student" && (
    input.university !== ACADEMIC_UNIVERSITY ||
    !isValidAcademicSelection(input.faculty, input.program)
  )) {
    throw new ApiError(
      422,
      "INVALID_ACADEMIC_SELECTION",
      "Universitet, fakültə və ixtisas seçimi rəsmi kataloqa uyğun deyil.",
      academicSelectionErrorDetails(input.university, input.faculty),
    );
  }

  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    if (existingUser.role === "teacher" && existingUser.status === "Gözləmədə") {
      throw new ApiError(409, "TEACHER_APPROVAL_PENDING", "Bu e-poçtla müəllim müraciəti artıq yaradılıb və rəhbərliyin təsdiqini gözləyir.");
    }
    throw new ApiError(409, "EMAIL_EXISTS", "Bu e-poçt artıq istifadə olunur.");
  }

  if (input.accountType !== "student" && input.university !== ACADEMIC_UNIVERSITY) {
    throw new ApiError(422, "INVALID_UNIVERSITY", `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`, {
      university: `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`,
    });
  }

  const isPrivilegedRegistration = input.accountType === "teacher";
  const user = await createUser({
    name: input.name,
    email: input.email,
    university: input.university,
    faculty: input.accountType === "teacher" ? "Müəllim heyəti" : input.faculty,
    program: input.program,
    role: input.accountType,
    status: isPrivilegedRegistration ? "Gözləmədə" : "Aktiv",
    passwordHash: await hashPassword(input.password),
    // E-poçt təsdiqi pilot üçün söndürülüb: hesab dərhal təsdiqlənir ki,
    // tələbə qeydiyyatdan sonra avtomatik daxil olsun (token qaytarılır).
    emailVerifiedAt: new Date().toISOString(),
    termsVersion: "2026-08-15",
    privacyVersion: "2026-08-15",
  });
  if (user.status !== "Aktiv") {
    const emailDelivered = user.emailVerifiedAt ? true : await trySendVerification(user);
    response.status(201).json({ data: { user: toPublicUser(user), requiresApproval: true, requiresEmailVerification: !user.emailVerifiedAt, emailDeliveryPending: !emailDelivered } });
    return;
  }
  if(!user.emailVerifiedAt){const emailDelivered=await trySendVerification(user);response.status(201).json({data:{user:toPublicUser(user),requiresApproval:false,requiresEmailVerification:true,emailDeliveryPending:!emailDelivered}});return;}
  response.status(201).json({ data: { token: await issueSession(user,request), user: toPublicUser(user), requiresApproval: false, requiresEmailVerification:false } });
});

authRouter.post("/login", loginLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body);
  // Açar mövcud olmayan e-poçt üçün də sayılır — hesabın varlığını açmır.
  const attemptKey = `login:${input.email}`;
  const locked = await getLockRemainingSeconds(attemptKey);
  if (locked) throw accountThrottled(locked);

  const user = await findUserByEmail(input.email);
  const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : await verifyAgainstDummy(input.password);

  if (!user || !passwordMatches) {
    const lockedNow = await registerFailedAttempt(attemptKey, LOGIN_ATTEMPTS);
    if (lockedNow) throw accountThrottled(lockedNow);
    throw new ApiError(401, "INVALID_CREDENTIALS", "E-poçt və ya şifrə düzgün deyil.");
  }
  await clearAttempts(attemptKey);
  if (user.status !== "Aktiv") {
    throw new ApiError(403, "ACCOUNT_RESTRICTED", "Hesab aktiv deyil.");
  }

  // Şifrə düzgündür, amma 2FA aktivdirsə sessiya hələ verilmir: yalnız 5
  // dəqiqəlik birdəfəlik bilet. Sessiya `/login/2fa`-da kod yoxlanandan sonra.
  if (await isTwoFactorEnabled(user.id)) {
    response.json({ data: { twoFactorRequired: true, challenge: await createLoginChallenge(user.id) } });
    return;
  }

  response.json({ data: { token: await issueSession(user,request), user: await publicUserWithSecurity(user) } });
});

const twoFactorLoginSchema = z.object({
  challenge: z.string().min(32).max(256),
  code: z.string().trim().min(6).max(20),
}).strict();

authRouter.post("/login/2fa", loginLimiter, async (request, response) => {
  const input = twoFactorLoginSchema.parse(request.body);
  const challenge = await findLoginChallenge(input.challenge);
  if (!challenge) throw new ApiError(401, "CHALLENGE_EXPIRED", "Giriş vaxtı bitdi. Şifrəni yenidən daxil et.");

  const user = await findUserById(challenge.userId);
  if (!user) throw new ApiError(401, "CHALLENGE_EXPIRED", "Giriş vaxtı bitdi. Şifrəni yenidən daxil et.");
  if (user.status !== "Aktiv") throw new ApiError(403, "ACCOUNT_RESTRICTED", "Hesab aktiv deyil.");

  let method: "totp" | "recovery";
  try {
    method = await assertSecondFactor(user.id, input.code);
  } catch (error) {
    // Kilid düşəndə bilet də ləğv olunur: davam etmək üçün şifrə yenidən lazımdır.
    if (error instanceof ApiError && error.code === "ACCOUNT_THROTTLED") await consumeLoginChallenge(challenge.id);
    throw error;
  }
  if (!(await consumeLoginChallenge(challenge.id))) {
    throw new ApiError(401, "CHALLENGE_EXPIRED", "Giriş vaxtı bitdi. Şifrəni yenidən daxil et.");
  }

  response.json({
    data: {
      token: await issueSession(user, request),
      user: await publicUserWithSecurity(user),
      recoveryCodeUsed: method === "recovery",
      recoveryCodesRemaining: method === "recovery" ? await countRecoveryCodes(user.id) : undefined,
    },
  });
});

authRouter.get("/session", authenticate, async (request, response) => {
  const user = await findUserById(request.auth!.userId);

  if (!user) {
    throw new ApiError(401, "SESSION_USER_NOT_FOUND", "Sessiya istifadəçisi tapılmadı.");
  }

  response.json({ data: { user: await publicUserWithSecurity(user) } });
});

/* ---------- İki mərhələli girişin idarəsi ---------- */

async function requireSessionUser(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new ApiError(401, "SESSION_USER_NOT_FOUND", "Sessiya istifadəçisi tapılmadı.");
  return user;
}

authRouter.get("/2fa", authenticate, async (request, response) => {
  const userId = request.auth!.userId;
  const enabled = await isTwoFactorEnabled(userId);
  response.json({ data: { enabled, recoveryCodesRemaining: enabled ? await countRecoveryCodes(userId) : 0 } });
});

/** 1-ci addım: şifrə təsdiqi → yeni sirr (hələ aktiv deyil). */
authRouter.post("/2fa/setup", authenticate, async (request, response) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).strict().parse(request.body);
  const user = await requireSessionUser(request.auth!.userId);
  await assertCurrentPassword(user, password);
  const secret = generateTotpSecret();
  if (!(await savePendingTwoFactor(user.id, encryptSecret(secret)))) {
    throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "İki mərhələli giriş artıq aktivdir.");
  }
  response.json({ data: { secret, otpauthUrl: totpUri(secret, user.email) } });
});

/** 2-ci addım: tətbiqdəki kod → aktivləşdirmə + birdəfəlik bərpa kodları. */
authRouter.post("/2fa/enable", authenticate, async (request, response) => {
  const { code } = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).strict().parse(request.body);
  const userId = request.auth!.userId;
  const record = await getTwoFactor(userId);
  if (!record) throw new ApiError(409, "TWO_FACTOR_NOT_STARTED", "Əvvəlcə quraşdırmanı başlat.");
  if (record.enabledAt) throw new ApiError(409, "TWO_FACTOR_ALREADY_ENABLED", "İki mərhələli giriş artıq aktivdir.");

  const key = `2fa:${userId}`;
  const locked = await getLockRemainingSeconds(key);
  if (locked) throw accountThrottled(locked);
  const step = verifyTotp(decryptSecret(record.secretEncrypted), code, record.lastUsedStep);
  if (step === null || !(await markTwoFactorStepUsed(userId, step, true))) {
    const lockedNow = await registerFailedAttempt(key, TWO_FACTOR_ATTEMPTS);
    if (lockedNow) throw accountThrottled(lockedNow);
    throw new ApiError(422, "TWO_FACTOR_INVALID", "Kod yanlışdır və ya vaxtı keçib.");
  }
  await clearAttempts(key);

  const recoveryCodes = generateRecoveryCodes();
  await replaceRecoveryCodes(userId, recoveryCodes);
  // Başqa cihazlardakı sessiyalar 2FA-sız açılıb — onlar bağlanır.
  await revokeAllSessions(userId, request.auth!.sessionId);
  response.json({ data: { enabled: true, recoveryCodes } });
});

const confirmWithCodeSchema = z.object({
  password: z.string().min(1).max(200),
  code: z.string().trim().min(6).max(20),
}).strict();

authRouter.post("/2fa/disable", authenticate, async (request, response) => {
  const input = confirmWithCodeSchema.parse(request.body);
  const user = await requireSessionUser(request.auth!.userId);
  if (!(await isTwoFactorEnabled(user.id))) throw new ApiError(409, "TWO_FACTOR_NOT_ENABLED", "İki mərhələli giriş aktiv deyil.");
  await assertCurrentPassword(user, input.password);
  await assertSecondFactor(user.id, input.code);
  await deleteTwoFactor(user.id);
  response.json({ data: { enabled: false } });
});

authRouter.post("/2fa/recovery-codes", authenticate, async (request, response) => {
  const input = confirmWithCodeSchema.parse(request.body);
  const user = await requireSessionUser(request.auth!.userId);
  if (!(await isTwoFactorEnabled(user.id))) throw new ApiError(409, "TWO_FACTOR_NOT_ENABLED", "İki mərhələli giriş aktiv deyil.");
  await assertCurrentPassword(user, input.password);
  await assertSecondFactor(user.id, input.code);
  const recoveryCodes = generateRecoveryCodes();
  await replaceRecoveryCodes(user.id, recoveryCodes);
  response.json({ data: { recoveryCodes } });
});

authRouter.patch("/profile", authenticate, async (request, response) => {
  const input = profileSchema.parse(request.body);
  const currentUser = await findUserById(request.auth!.userId);

  if (!currentUser) {
    throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  }

  const keepsLegacyAcademicSelection =
    currentUser.university === input.university &&
    currentUser.faculty === input.faculty &&
    currentUser.program === input.program;

  if (currentUser.role === "student" &&
    !keepsLegacyAcademicSelection &&
    (input.university !== ACADEMIC_UNIVERSITY ||
      !isValidAcademicSelection(input.faculty, input.program))
  ) {
    throw new ApiError(
      422,
      "INVALID_ACADEMIC_SELECTION",
      "Universitet, fakültə və ixtisas seçimi rəsmi kataloqa uyğun deyil.",
      academicSelectionErrorDetails(input.university, input.faculty),
    );
  }

  if (currentUser.role !== "student" && input.university !== ACADEMIC_UNIVERSITY) {
    throw new ApiError(422, "INVALID_UNIVERSITY", `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`, {
      university: `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`,
    });
  }

  const user = await updateUserProfile(request.auth!.userId, input);

  if (!user) {
    throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  }

  await synchronizeProfessionalProfilesForUser(user);

  response.json({ data: { user: toPublicUser(user) } });
});

authRouter.post("/logout", authenticate, async (request, response) => {
  if(request.auth?.sessionId)await revokeSession(request.auth.userId,request.auth.sessionId);
  response.status(204).send();
});

authRouter.post("/verify-email/request",signupLimiter,async(request,response)=>{const {email}=emailSchema.parse(request.body);const user=await findUserByEmail(email);if(user&&!user.emailVerifiedAt)await trySendVerification(user);response.status(202).json({data:{accepted:true}});});
authRouter.post("/verify-email/confirm",async(request,response)=>{const {token}=tokenSchema.parse(request.body);const userId=await consumeActionToken(token,"verify_email");if(!userId)throw new ApiError(422,"TOKEN_INVALID","Təsdiq keçidi etibarsızdır və ya vaxtı bitib.");const user=await markEmailVerified(userId);if(!user)throw new ApiError(404,"USER_NOT_FOUND","İstifadəçi tapılmadı.");response.json({data:{verified:true}});});
authRouter.post("/password/forgot",loginLimiter,async(request,response)=>{
  const {email}=emailSchema.parse(request.body);
  const user=await findUserByEmail(email);
  if(user){
    const code=await createActionCode(user.id,"reset_password",10*60*1000);
    try{await sendAccountEmail({to:user.email,subject:"EduRate • Şifrə bərpa kodunuz",html:passwordResetEmailHtml(user.name,code)});}
    catch(error){if(error instanceof EmailDeliveryError)throw new ApiError(503,"EMAIL_DELIVERY_UNAVAILABLE",error.message);throw error;}
  }
  response.status(202).json({data:{accepted:true}});
});
authRouter.post("/password/verify-code",loginLimiter,async(request,response)=>{
  const input=resetCodeSchema.parse(request.body);
  // 6 rəqəmli kod: hesab üzrə 5 səhv cəhddən sonra 30 dəqiqəlik kilid (əvvəl
  // yalnız ortaq IP limiti var idi).
  const attemptKey=`reset:${input.email}`;
  const locked=await getLockRemainingSeconds(attemptKey);
  if(locked)throw accountThrottled(locked);
  const user=await findUserByEmail(input.email);
  if(!user||!await consumeActionCode(user.id,input.code,"reset_password")){
    const lockedNow=await registerFailedAttempt(attemptKey,RESET_CODE_ATTEMPTS);
    if(lockedNow)throw accountThrottled(lockedNow);
    throw new ApiError(422,"CODE_INVALID","Bərpa kodu yanlışdır və ya vaxtı bitib.");
  }
  await clearAttempts(attemptKey);
  const resetToken=await createActionToken(user.id,"reset_password",10*60*1000);
  response.json({data:{verified:true,resetToken}});
});
authRouter.post("/password/reset",loginLimiter,async(request,response)=>{
  const input=resetSchema.parse(request.body);
  // Bilet istifadə olunmazdan ƏVVƏL: zəif şifrə bileti yandırmasın. (Ad/e-poçt
  // yoxlaması istifadəçi məlum olmadığı üçün burada yox, frontend-dədir.)
  assertStrongPassword(input.password);
  const userId=await consumeActionToken(input.resetToken,"reset_password");
  if(!userId)throw new ApiError(422,"RESET_EXPIRED","Şifrə yeniləmə icazəsinin vaxtı bitib. Yeni kod istəyin.");
  await updatePassword(userId,await hashPassword(input.password));
  await markEmailVerified(userId);
  await revokeAllSessions(userId);
  response.json({data:{reset:true}});
});
/**
 * Istifadeci oz hesabini silir (GDPR "unudulma huququ").
 *
 * Silinme geri qaytarilmadigi ucun parol tesdiqi teleb olunur: yalnizca
 * sessiya oglanmasi ile hesab silinmesin. Platformani sahibsiz qoymamaq ucun
 * admin rollari bu yolla silinmir - onlar bashqa adminle elaqe saxlamalidir.
 */
authRouter.delete("/account", authenticate, async (request, response) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(request.body);
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");

  // Əvvəl burada limitsiz `verifyPassword` idi: açıq qalmış sessiyası olan şəxs
  // şifrəni sonsuz təxmin edə bilirdi. İndi girişlə eyni hesab sayğacıdır.
  await assertCurrentPassword(user, password);
  if (user.role === "admin" || user.role === "assistant_admin" || user.role === "owner_admin") {
    throw new ApiError(409, "ADMIN_SELF_DELETE_FORBIDDEN", "Administrator hesabı bu yolla silinmir. Digər administratorla əlaqə saxla.");
  }

  await revokeAllSessions(user.id);
  // Admin silməsi bunu edirdi, öz-özünə silmə yox: hesabını silən müəllim və
  // mentor kataloqda REAL ADI ilə qalırdı və tələbələr ona müraciət göndərə bilirdi.
  await deactivateProfessionalProfilesForUser(user.id);
  if (!(await deleteUser(user.id))) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  response.status(204).send();
});

authRouter.get("/sessions",authenticate,async(request,response)=>response.json({data:await listSessions(request.auth!.userId,request.auth!.sessionId)}));
authRouter.delete("/sessions/:id",authenticate,async(request,response)=>{const id=z.string().uuid().parse(request.params.id);if(!await revokeSession(request.auth!.userId,id))throw new ApiError(404,"SESSION_NOT_FOUND","Sessiya tapılmadı.");response.status(204).send();});
authRouter.delete("/sessions",authenticate,async(request,response)=>{await revokeAllSessions(request.auth!.userId,request.auth!.sessionId);response.status(204).send();});

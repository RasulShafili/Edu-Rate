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
  recordLegalAcceptance,
  claimUnverifiedUser,
  type UserRecord,
} from "../db/database.js";
import { buildAccountExport } from "../db/account-export.js";
import { deleteNotificationsForUser } from "../db/notifications.js";
import { removeAllSubscriptions } from "../db/push.js";
import { LEGAL_VERSION } from "../lib/legal.js";
import {
  codeEmailHtml,
  LOGIN_CODE_TTL_MS,
  loginCodeEmail,
  loginCodeSettings,
  maskEmail,
  MAX_SENDS_PER_CHALLENGE,
  noteCodeSent,
  RESEND_COOLDOWN_MS,
  resendWaitSeconds,
  sendsForChallenge,
  signupCodeEmail,
} from "../lib/login-code.js";
import { removeUserAvatar } from "./media.js";
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
  invalidateLoginChallenges,
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
import { clientIp, clientIpKey, userOrIpKey } from "../lib/client-key.js";

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
  return codeEmailHtml({
    name,
    code,
    title:"EduRate bərpa kodu",
    heading:"Şifrənizi təhlükəsiz yeniləyin.",
    lead:"Hesabınıza qayıtmaq üçün birdəfəlik kodunuz hazırdır.",
    instruction:"Aşağıdakı 6 rəqəmli kodu EduRate şifrə bərpası səhifəsinə daxil edin.",
    label:"BƏRPA KODU",
    note:"Bu sorğunu siz etməmisinizsə, məktubu nəzərə almayın və kodu heç kimlə paylaşmayın.",
  });
}

/*
 * E-poçt kodu mərhələsi. Təsdiqlənməmiş e-poçt (yeni qeydiyyat) üçün
 * `verify_email`, digər hallarda `login_code` kodu göndərilir; hər ikisi eyni
 * `/login/email-code` endpoint-i ilə yoxlanır.
 */
function emailCodePurpose(user:UserRecord){return user.emailVerifiedAt?"login_code" as const:"verify_email" as const;}

async function sendEmailCode(user:UserRecord){
  const purpose=emailCodePurpose(user);
  const code=await createActionCode(user.id,purpose,LOGIN_CODE_TTL_MS);
  const message=purpose==="login_code"?loginCodeEmail(user.name,code):signupCodeEmail(user.name,code);
  try{await sendAccountEmail({to:user.email,...message});}
  catch(error){if(error instanceof EmailDeliveryError)throw new ApiError(503,"EMAIL_DELIVERY_UNAVAILABLE",error.message);throw error;}
}

async function startEmailCode(user:UserRecord){
  await sendEmailCode(user);
  const challenge=await createLoginChallenge(user.id,LOGIN_CODE_TTL_MS);
  noteCodeSent(user.id,challenge);
  return {emailCodeRequired:true as const,challenge,emailHint:maskEmail(user.email),purpose:emailCodePurpose(user)};
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
  let claimable = false;

  if (existingUser) {
    if (existingUser.role === "teacher" && existingUser.status === "Gözləmədə") {
      throw new ApiError(409, "TEACHER_APPROVAL_PENDING", "Bu e-poçtla müəllim müraciəti artıq yaradılıb və rəhbərliyin təsdiqini gözləyir.");
    }
    // Təsdiqlənməmiş (kod daxil edilməmiş) eyni rolda hesab təhvil alınır: yarımçıq qeydiyyat və
    // başqasının e-poçtu ilə "tutulmuş" hesab əsl sahibi bloklamır. Təsdiqlənmiş hesab toxunulmazdır.
    claimable = loginCodeSettings.enabled && !existingUser.emailVerifiedAt && existingUser.status === "Aktiv" && existingUser.role === input.accountType;
    if (!claimable) throw new ApiError(409, "EMAIL_EXISTS", "Bu e-poçt artıq istifadə olunur.");
    // Qurbanın poçt qutusuna kod yağdırmaq mümkün olmasın (eyni cooldown yenidən göndərmədəki kimi).
    const wait = resendWaitSeconds(existingUser.id);
    if (wait) throw new ApiError(429, "RESEND_TOO_SOON", `Yeni kod üçün ${wait} saniyə gözlə.`, { retryAfter: String(wait) });
  }

  if (input.accountType !== "student" && input.university !== ACADEMIC_UNIVERSITY) {
    throw new ApiError(422, "INVALID_UNIVERSITY", `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`, {
      university: `Universitet yalnız “${ACADEMIC_UNIVERSITY}” ola bilər.`,
    });
  }

  const isPrivilegedRegistration = input.accountType === "teacher";
  const passwordHash = await hashPassword(input.password);
  const claimed = claimable && existingUser
    ? await claimUnverifiedUser(existingUser.id, {
      name: input.name,
      university: input.university,
      faculty: input.accountType === "teacher" ? "Müəllim heyəti" : input.faculty,
      program: input.program,
      passwordHash,
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    })
    : null;
  // Arada hesab təsdiqlənibsə (yarış) təhvil alınmır — adi "artıq istifadə olunur" cavabı.
  if (claimable && !claimed) throw new ApiError(409, "EMAIL_EXISTS", "Bu e-poçt artıq istifadə olunur.");
  if (claimed) await invalidateLoginChallenges(claimed.id);
  const user = claimed ?? await createUser({
    name: input.name,
    email: input.email,
    university: input.university,
    faculty: input.accountType === "teacher" ? "Müəllim heyəti" : input.faculty,
    program: input.program,
    role: input.accountType,
    status: isPrivilegedRegistration ? "Gözləmədə" : "Aktiv",
    passwordHash,
    // E-poçt təsdiqi pilot üçün söndürülüb: hesab dərhal təsdiqlənir ki,
    // tələbə qeydiyyatdan sonra avtomatik daxil olsun (token qaytarılır).
    // E-poçt kodu aktivdirsə, ünvan kodla təsdiqlənənə qədər hesab açılmır:
    // başqasının Gmail-i ilə qeydiyyatdan keçib daxil olmaq olmur.
    emailVerifiedAt: loginCodeSettings.enabled ? null : new Date().toISOString(),
    termsVersion: LEGAL_VERSION,
    privacyVersion: LEGAL_VERSION,
  });
  if (loginCodeSettings.enabled) {
    response.status(201).json({ data: { ...(await startEmailCode(user)), user: toPublicUser(user), requiresApproval: user.status !== "Aktiv" } });
    return;
  }
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

  // Şifrə düzgündür, amma sessiya yalnız e-poçta gələn kodla verilir.
  if (loginCodeSettings.enabled) {
    response.json({ data: await startEmailCode(user) });
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

const emailCodeSchema = z.object({
  challenge: z.string().min(32).max(256),
  code: z.string().trim().regex(/^\d{6}$/, "Kod 6 rəqəmdən ibarət olmalıdır."),
}).strict();
// Kod addımının öz IP limiti: girişin büdcəsini yeməsin (bir-iki səhv kod +
// yenidən göndərmə istifadəçini kilidləməsin). Əsas qoruma hesab üzrə 5 cəhddir.
const emailCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: clientIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Çox sayda cəhd edildi." } },
});
const emailChallengeSchema = z.object({ challenge: z.string().min(32).max(256) }).strict();

/** Bilet → istifadəçi. 2FA (TOTP) hesabında e-poçt kodu işləmir: 2FA-dan yan keçmək olmasın. */
async function emailChallengeUser(token: string) {
  const challenge = await findLoginChallenge(token);
  const user = challenge ? await findUserById(challenge.userId) : null;
  if (!challenge || !user || await isTwoFactorEnabled(user.id)) {
    throw new ApiError(401, "CHALLENGE_EXPIRED", "Kodun vaxtı bitdi. Yenidən daxil ol.");
  }
  if (user.status !== "Aktiv" && !(user.status === "Gözləmədə" && !user.emailVerifiedAt)) {
    throw new ApiError(403, "ACCOUNT_RESTRICTED", "Hesab aktiv deyil.");
  }
  return { challenge, user };
}

/** Girişin (və qeydiyyatın) ikinci mərhələsi: e-poçta gələn 6 rəqəmli kod. */
authRouter.post("/login/email-code", emailCodeLimiter, async (request, response) => {
  const input = emailCodeSchema.parse(request.body);
  const { challenge, user } = await emailChallengeUser(input.challenge);

  const attemptKey = `email-code:${user.id}`;
  const locked = await getLockRemainingSeconds(attemptKey);
  if (locked) {
    await consumeLoginChallenge(challenge.id);
    throw accountThrottled(locked);
  }
  if (!(await consumeActionCode(user.id, input.code, emailCodePurpose(user)))) {
    const lockedNow = await registerFailedAttempt(attemptKey, RESET_CODE_ATTEMPTS);
    if (lockedNow) {
      // Kilid düşəndə bilet də yanır: davam etmək üçün şifrə yenidən lazımdır.
      await consumeLoginChallenge(challenge.id);
      throw accountThrottled(lockedNow);
    }
    throw new ApiError(422, "CODE_INVALID", "Kod yanlışdır və ya vaxtı bitib.");
  }
  await clearAttempts(attemptKey);
  if (!(await consumeLoginChallenge(challenge.id))) {
    throw new ApiError(401, "CHALLENGE_EXPIRED", "Kodun vaxtı bitdi. Yenidən daxil ol.");
  }

  const verified = user.emailVerifiedAt ? user : (await markEmailVerified(user.id)) ?? user;
  if (verified.status !== "Aktiv") {
    response.json({ data: { requiresApproval: true, user: toPublicUser(verified) } });
    return;
  }
  response.json({ data: { token: await issueSession(verified, request), user: await publicUserWithSecurity(verified) } });
});

/** Kodu yenidən göndər: 60 saniyədə bir, bilet başına ən çox 5 dəfə. */
authRouter.post("/login/email-code/resend", emailCodeLimiter, async (request, response) => {
  const { challenge } = emailChallengeSchema.parse(request.body);
  const { user } = await emailChallengeUser(challenge);
  const wait = resendWaitSeconds(user.id);
  if (wait) {
    throw new ApiError(429, "RESEND_TOO_SOON", `Yeni kod üçün ${wait} saniyə gözlə.`, { retryAfter: String(wait) });
  }
  if (sendsForChallenge(challenge) >= MAX_SENDS_PER_CHALLENGE) {
    throw new ApiError(429, "RESEND_LIMIT", "Çox sayda kod istənildi. Yenidən daxil ol.");
  }
  await sendEmailCode(user);
  noteCodeSent(user.id, challenge);
  response.json({ data: { sent: true, emailHint: maskEmail(user.email), retryAfter: RESEND_COOLDOWN_MS / 1000 } });
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
  // Məxfilik siyasətinə uyğun: cihaz abunələri, bildirişlər və profil şəkli
  // dərhal silinir; rəy və mesajlar "Silinmiş istifadəçi" adı ilə qalır.
  await Promise.all([removeAllSubscriptions(user.id), deleteNotificationsForUser(user.id), removeUserAvatar(user.id)]);
  response.status(204).send();
});

/** Yenilənmiş İstifadə şərtləri və Məxfilik siyasətinin qəbulu. */
authRouter.post("/legal-consent", authenticate, async (request, response) => {
  z.object({ accepted: z.literal(true), version: z.literal(LEGAL_VERSION) }).strict().parse(request.body);
  const user = await recordLegalAcceptance(request.auth!.userId, LEGAL_VERSION);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  response.json({ data: { user: await publicUserWithSecurity(user) } });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
}).strict();

/**
 * Daxil olmuş istifadəçinin şifrə dəyişməsi. Əvvəl yalnız "Şifrəni unutdum" var idi:
 * hesabın şifrəsi sızıbsa və ya zəifdirsə, istifadəçi onu dəyişə bilmirdi.
 * Cari şifrə girişlə eyni sayğacla yoxlanır, digər cihazların sessiyaları bağlanır.
 */
authRouter.post("/password/change", authenticate, loginLimiter, async (request, response) => {
  const input = changePasswordSchema.parse(request.body);
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  await assertCurrentPassword(user, input.currentPassword);
  assertStrongPassword(input.newPassword, { email: user.email, name: user.name });
  if (input.newPassword === input.currentPassword) {
    throw new ApiError(422, "SAME_PASSWORD", "Yeni şifrə cari şifrədən fərqli olmalıdır.");
  }
  await updatePassword(user.id, await hashPassword(input.newPassword));
  await revokeAllSessions(user.id, request.auth!.sessionId);
  response.status(204).send();
});

// İxrac ağır sorğudur: saatda 3 dəfə kifayətdir.
const exportLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 3, keyGenerator: userOrIpKey, standardHeaders: true, legacyHeaders: false });
/** "Məlumatlarımı yüklə": istifadəçinin öz fərdi məlumatlarının JSON surəti. */
authRouter.get("/account/export", authenticate, exportLimiter, async (request, response) => {
  const user = await findUserById(request.auth!.userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "İstifadəçi tapılmadı.");
  response.setHeader("Cache-Control", "no-store");
  response.json({ data: await buildAccountExport(user) });
});

authRouter.get("/sessions",authenticate,async(request,response)=>response.json({data:await listSessions(request.auth!.userId,request.auth!.sessionId)}));
authRouter.delete("/sessions/:id",authenticate,async(request,response)=>{const id=z.string().uuid().parse(request.params.id);if(!await revokeSession(request.auth!.userId,id))throw new ApiError(404,"SESSION_NOT_FOUND","Sessiya tapılmadı.");response.status(204).send();});
authRouter.delete("/sessions",authenticate,async(request,response)=>{await revokeAllSessions(request.auth!.userId,request.auth!.sessionId);response.status(204).send();});

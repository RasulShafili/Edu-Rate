/**
 * Şifrə siyasəti — backend və frontend EYNİ faylı işlədir:
 * `backend/src/lib/password-policy.ts` və `app/lib/password-policy.ts` bayt-bayt
 * eynidir (`tests/security.test.mjs` bunu yoxlayır). Birini dəyişsən, o birini
 * də köçür.
 *
 * Əvvəlki qayda yalnız "8 simvol + hərf + rəqəm" idi — `password1`, `qwerty123`
 * kimi sızmış siyahıların başındakı şifrələr keçirdi.
 */
export type PasswordProblem =
  | "tooShort"
  | "tooLong"
  | "needsLetter"
  | "needsDigit"
  | "common"
  | "personal"
  | "repetitive";

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt 72 BAYTDAN sonrasını nəzərə almır; "ə", "ş" kimi hərflər 2 baytdır. */
export const PASSWORD_MAX_BYTES = 72;

/** Sızmış siyahılarda ən çox rast gəlinən söz kökləri (rəqəm/simvol əlavəsi ilə). */
const COMMON_WORDS = [
  "password", "passw0rd", "parol", "sifre", "şifrə", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl",
  "zxcvbn", "iloveyou", "welcome", "admin", "administrator", "letmein", "login", "user", "test",
  "abc", "abcd", "abcde", "abcdef", "abcdefg", "abcdefgh", "qwe", "qweasd", "qazwsx", "football",
  "monkey", "dragon", "master", "shadow", "sunshine", "princess", "baseball", "superman", "batman",
  "azerbaijan", "azerbaycan", "azərbaycan", "baku", "baki", "bakı", "qarabag", "qarabağ", "karabakh",
  "edurate", "student", "telebe", "tələbə", "university", "universitet", "salam", "hello", "secret",
  "changeme", "google", "samsung", "iphone", "love", "aaaa", "q1w2e3r4", "1q2w3e4r", "1q2w3e4r5t",
];

/** Tam şəkildə məşhur olan, hərf+rəqəm qaydasını keçən şifrələr. */
const COMMON_PASSWORDS = new Set([
  "1q2w3e4r5t", "1q2w3e4r5t6y", "q1w2e3r4t5", "q1w2e3r4t5y6", "1qaz2wsx3edc", "zaq12wsx", "a1b2c3d4e5",
  "123456789a", "a123456789", "1234567890a", "abc1234567", "123qweasdzxc", "qwe123456789", "123456789q",
  "1234567890q", "qwerty123456", "123456qwerty", "1234qwer", "qwer1234", "1234abcd", "abcd1234",
]);

const letterPattern = /\p{L}/u;
const digitPattern = /\d/;

function lettersOnly(value: string) {
  return value.toLocaleLowerCase("az").replace(/[^\p{L}]/gu, "");
}

function isSequential(value: string) {
  if (value.length < 4) return false;
  let ascending = 0;
  let descending = 0;
  for (let index = 1; index < value.length; index += 1) {
    const difference = value.charCodeAt(index) - value.charCodeAt(index - 1);
    if (difference === 1) ascending += 1;
    if (difference === -1) descending += 1;
  }
  return ascending >= value.length - 2 || descending >= value.length - 2;
}

/** Siyasətin ilk pozulan qaydası (və ya `null`). Sıra UI mesajlarının sırasıdır. */
export function findPasswordProblem(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "tooLong";
  if (!letterPattern.test(password)) return "needsLetter";
  if (!digitPattern.test(password)) return "needsDigit";

  const lower = password.toLocaleLowerCase("az");
  if (COMMON_PASSWORDS.has(lower)) return "common";
  // "Password2026!", "qwerty12345" — məşhur söz + rəqəm/simvol əlavəsi.
  const letters = lettersOnly(password);
  if (COMMON_WORDS.includes(letters)) return "common";
  if (COMMON_WORDS.some((word) => word.length >= 5 && letters.startsWith(word) && letters.length - word.length <= 2)) return "common";

  const personal = [
    ...(context.email ? [context.email.split("@")[0] ?? ""] : []),
    ...(context.name ? context.name.split(/\s+/) : []),
  ]
    .flatMap((part) => part.split(/[._+-]/))
    .map((part) => part.toLocaleLowerCase("az"))
    .filter((part) => part.length >= 4);
  if (personal.some((part) => lower.includes(part))) return "personal";

  if (new Set(lower).size <= 4) return "repetitive";
  if (isSequential(lower.replace(/[^\p{L}\d]/gu, ""))) return "repetitive";

  return null;
}

/**
 * Göstərici üçün 0–4 bal. Yalnız ipucudur; qəbul/rədd qərarı
 * `findPasswordProblem`-dədir.
 */
export function scorePassword(password: string, context: { email?: string; name?: string } = {}) {
  if (!password) return 0;
  if (findPasswordProblem(password, context)) return 1;
  let classes = 0;
  if (/[a-zəöüğşçı]/u.test(password)) classes += 1;
  if (/[A-ZƏÖÜĞŞÇİ]/u.test(password)) classes += 1;
  if (digitPattern.test(password)) classes += 1;
  if (/[^\p{L}\d]/u.test(password)) classes += 1;
  if (password.length >= 16 || (password.length >= 12 && classes >= 3)) return 4;
  if (password.length >= 12 || classes >= 3) return 3;
  return 2;
}

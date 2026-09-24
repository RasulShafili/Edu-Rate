import {
  createIdentityProfile,
  getInitials,
  type UserProfile,
} from "../../data/user";
import { ApiHttpError } from "../api/http";
import { readCookieValue } from "./cookies";
import { authSessionCookieSecurity, authSessionMaxAgeSeconds } from "./session-policy";

const defaultApiBaseUrl = "https://edurate-api.onrender.com";
export const remoteCredentialCookieName = "edurate_api_token";

export type RemoteApiUser = {
  id: string;
  name: string;
  email: string;
  university: string;
  faculty: string;
  program?: string;
  year?: string;
  city?: string;
  about?: string;
  role: "student" | "mentor" | "teacher" | "admin" | "assistant_admin" | "owner_admin";
  createdAt: string;
  twoFactorEnabled?: boolean;
};

type RemoteEnvelope<T> = { data: T };
type RemoteErrorEnvelope = {
  error?: { code?: string; message?: string; details?: Record<string, string> };
};

export const remoteCredentialCookie = {
  name: remoteCredentialCookieName,
  options: {
    ...authSessionCookieSecurity,
    path: "/",
    maxAge: authSessionMaxAgeSeconds,
    priority: "high" as const,
  },
};

export function getRemoteCredentialCookieOptions(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = process.env.NODE_ENV === "production"
    || forwardedProtocol === "https"
    || new URL(request.url).protocol === "https:";
  return { ...remoteCredentialCookie.options, secure };
}

export function readRemoteCredentialToken(request: Request): string | undefined {
  return readCookieValue(request.headers.get("cookie"), remoteCredentialCookieName);
}

export async function requestRemoteApi<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const method=options.method??"GET";
  const attempts=method==="GET"?2:1;
  // Oxuma sorğuları tez uğursuz olmalıdır ki, backend "yuxuda" olanda (Render
  // pulsuz plan soyuq start ~30-60s) sayt 65 saniyə donmasın — bunun əvəzinə
  // nümunə məlumatla dərhal açılır. Yazma sorğuları (giriş/qeydiyyat) bir qədər
  // daha uzun gözləyir, çünki onların uğuru vacibdir.
  const timeoutMs=method==="GET"?8_000:22_000;
  let response:Response|null=null;
  for(let attempt=0;attempt<attempts;attempt+=1){
    try{
      response=await fetch(`${getRemoteApiBaseUrl()}${normalizePath(path)}`,{
        method,
        headers,
        cache:"no-store",
        body:options.body===undefined?undefined:JSON.stringify(options.body),
        signal:AbortSignal.timeout(timeoutMs),
      });
      if(![502,503,504].includes(response.status)||attempt===attempts-1)break;
    }catch{
      if(attempt===attempts-1)throw new ApiHttpError(503,"API_SERVICE_UNAVAILABLE","EduRate xidməti ilə əlaqə yaratmaq mümkün olmadı. Bir qədər sonra yenidən yoxla.");
    }
    await waitForRetry(attempt);
  }
  if(!response)throw new ApiHttpError(503,"API_SERVICE_UNAVAILABLE","EduRate xidməti ilə əlaqə yaratmaq mümkün olmadı. Bir qədər sonra yenidən yoxla.");

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | RemoteEnvelope<T>
    | RemoteErrorEnvelope
    | null;

  if (!response.ok) {
    const remoteError = payload && "error" in payload ? payload.error : undefined;
    throw new ApiHttpError(
      response.status,
      remoteError?.code ?? "REMOTE_API_ERROR",
      remoteError?.message ?? "Əməliyyat tamamlanmadı.",
      remoteError?.details,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ApiHttpError(502, "INVALID_REMOTE_RESPONSE", "EduRate xidməti etibarlı cavab qaytarmadı.");
  }

  return payload.data;
}

export async function getRemoteSession(token: string) {
  return requestRemoteApi<{ user: RemoteApiUser }>("/api/auth/session", { token });
}

/**
 * Backend yeni hesabı bu mətnlərlə yaradır (`createUser`, sütun default-ları).
 * Onlar istifadəçinin yazdığı məlumat deyil — boş sayılmalıdır.
 */
const STORED_PLACEHOLDERS = new Set([
  "Kurs məlumatı əlavə edilməyib",
  "İxtisas məlumatı əlavə edilməyib",
  "EduRate icmasında universitet həyatını daha əlaqəli yaşamaq üçün buradayam.",
]);

function filledValue(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return STORED_PLACEHOLDERS.has(trimmed) ? "" : trimmed;
}

export function mapRemoteUserToProfile(user: RemoteApiUser): UserProfile {
  const base = createIdentityProfile(user.name, user.email);
  const profile = {
    ...base,
    id: user.id,
    name: user.name,
    initials: getInitials(user.name),
    accessRole: user.role,
    twoFactorEnabled: user.twoFactorEnabled === true,
    university: user.university,
    faculty: user.faculty,
    program: user.program || "İxtisas məlumatı əlavə edilməyib",
    year: user.year || "Kurs məlumatı əlavə edilməyib",
    city: user.city || "Azərbaycan",
    about: user.about || "EduRate icmasına xoş gəlmisən.",
  };

  // Əvvəl sayım yer tutucular QOYULANDAN SONRA aparılırdı — hər sahə həmişə
  // "dolu" görünürdü və profil hamı üçün 100% idi.
  const details = { program: filledValue(user.program), year: filledValue(user.year), about: filledValue(user.about) };
  const completed = [
    user.name,
    user.university,
    user.faculty,
    details.program,
    details.year,
    details.about,
  ].filter((value) => filledValue(value).length > 0).length;

  const roleLabels: Record<RemoteApiUser["role"], UserProfile["role"]> = {
    student: "Tələbə",
    teacher: "Müəllim",
    mentor: "Mentor",
    assistant_admin: "Rəhbərlik",
    admin: "Rəhbərlik",
    owner_admin: "Rəhbərlik",
  };
  return { ...profile, details, role: roleLabels[user.role], completion: Math.round((completed / 6) * 100) };
}

function getRemoteApiBaseUrl() {
  const value = process.env.EDURATE_API_BASE_URL?.trim() || defaultApiBaseUrl;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !isLocalhost) throw new Error();
    return url.origin;
  } catch {
    throw new ApiHttpError(500, "INVALID_API_CONFIG", "Backend API ünvanı düzgün qurulmayıb.");
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function waitForRetry(attempt:number){return new Promise((resolve)=>setTimeout(resolve,attempt===0?350:900));}

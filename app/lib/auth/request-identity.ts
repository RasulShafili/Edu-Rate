import { cache } from "react";
import { cookies } from "next/headers";
import { ApiHttpError } from "../api/http";
import { readCookieValue } from "./cookies";
import type { UserProfile } from "../../data/user";
import {
  getRemoteSession,
  mapRemoteUserToProfile,
  remoteCredentialCookieName,
} from "./remote-credential";

export type RequestIdentity = {
  email: string;
  displayName: string;
  source: "credential";
  role?: "student" | "mentor" | "teacher" | "admin" | "assistant_admin" | "owner_admin";
  /** Tam profil — server artıq bütün istifadəçini alır, yalnız ilk render üçün. */
  profile?: UserProfile;
};

export async function getRequestIdentity(request: Request): Promise<RequestIdentity | null> {
  const remoteToken = readCookieValue(
    request.headers.get("cookie"),
    remoteCredentialCookieName,
  );
  if (remoteToken) {
    try {
      const session = await getRemoteSession(remoteToken);
      return {
        email: session.user.email,
        displayName: session.user.name,
        source: "credential",
        role: session.user.role,
      };
    } catch {
      return null;
    }
  }
  return null;
}

/** Backend cavab vermir (Render soyuq başlanğıcı, şəbəkə) — sessiya bilinmir, yox deyil. */
export class SessionUnavailableError extends Error {
  constructor() {
    super("SESSION_UNAVAILABLE");
    this.name = "SessionUnavailableError";
  }
}

/**
 * Layout və səhifə hər sorğuda bunu çağırır, ona görə `cache` ilə bir dəfə
 * gedir. Səhifəni bloklayır, buna görə qısa gözləyir: əvvəl yatmış backend-i
 * 2×8 saniyə gözləyirdi — daxil olmuş istifadəçi 16 saniyə ağ ekran görür,
 * sonra "çıxmış" sayılıb /auth-a atılırdı. İndi:
 *  - `null` — kuki yoxdur və ya backend sessiyanı rədd etdi (401/403);
 *  - `SessionUnavailableError` — backend cavab vermədi; istifadəçi çıxarılmır.
 */
export const getServerRequestIdentity = cache(async (): Promise<RequestIdentity | null> => {
  const cookieStore = await cookies();
  const remoteToken = cookieStore.get(remoteCredentialCookieName)?.value;
  if (!remoteToken) return null;
  try {
    const session = await getRemoteSession(remoteToken, { timeoutMs: 3_500, attempts: 1 });
    return {
      email: session.user.email,
      displayName: session.user.name,
      source: "credential",
      role: session.user.role,
      profile: mapRemoteUserToProfile(session.user),
    };
  } catch (error) {
    if (error instanceof ApiHttpError && (error.status === 401 || error.status === 403)) return null;
    throw new SessionUnavailableError();
  }
});

/** Səhifələr üçün: sessiya, `null` (daxil olmayıb) və ya "unavailable" (backend oyanır). */
export async function resolveServerIdentity(): Promise<RequestIdentity | null | "unavailable"> {
  try {
    return await getServerRequestIdentity();
  } catch (error) {
    if (error instanceof SessionUnavailableError) return "unavailable";
    throw error;
  }
}

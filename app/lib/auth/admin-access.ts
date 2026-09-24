import { getServerRequestIdentity } from "./request-identity";
import {
  isAdminAccessRole,
  type AdminAccessRole,
} from "./admin-role";

export type AdminPrincipal = {
  displayName: string;
  email: string;
  role: AdminAccessRole;
};

export type AdminAccess =
  | { status: "granted"; principal: AdminPrincipal }
  | { status: "signed-out"; signInHref: string }
  | { status: "forbidden" }
  | { status: "two-factor-required" }
  | { status: "unavailable" };

/**
 * Server-only authorization boundary for administrator pages. The browser never
 * supplies a role and production never falls back to a demo administrator.
 */
export async function resolveAdminAccess(
  options: { allowAssistant?: boolean } = {},
): Promise<AdminAccess> {
  try {
    const identity = await getServerRequestIdentity();
    if (!identity) return { status: "signed-out", signInHref: "/auth?returnTo=%2Fadmin" };

    const role = identity.role;
    const hasAccess = role === "owner_admin" || role === "admin"
      || (options.allowAssistant === true && role === "assistant_admin");

    // Backend admin API-si 2FA-sız rəhbərlik hesabını rədd edir (TWO_FACTOR_REQUIRED);
    // panel boş yüklənmək əvəzinə bunu əvvəlcədən izah edir.
    if (hasAccess && identity.profile && !identity.profile.twoFactorEnabled && process.env.ADMIN_2FA_REQUIRED !== "false") {
      return { status: "two-factor-required" };
    }

    return hasAccess && isAdminAccessRole(role)
      ? {
          status: "granted",
          principal: {
            displayName: identity.displayName,
            email: identity.email,
            role,
          },
        }
      : { status: "forbidden" };
  } catch {
    return { status: "unavailable" };
  }
}

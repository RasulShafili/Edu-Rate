import { ApiError } from "./api/client";

/**
 * İdarəetmə panelinin xətalarını tərcümə AÇARINA çevirir.
 *
 * Əvvəl panel backend-in azərbaycanca `message`-ini olduğu kimi göstərirdi: EN/RU
 * interfeysdə xəta azərbaycanca qalırdı, dil dəyişəndə də yenilənmirdi. Açar
 * vəziyyətdə saxlanır və render zamanı `t()` ilə açılır.
 */
const CODE_KEYS: Record<string, string> = {
  SELF_ADMIN_LOCKOUT_FORBIDDEN: "admin.error.selfLockout",
  SELF_DELETE_FORBIDDEN: "admin.error.selfDelete",
  LAST_OWNER_REQUIRED: "admin.error.lastOwner",
  USER_ROLE_CHANGED: "admin.error.roleChanged",
  ROLE_ESCALATION_FORBIDDEN: "admin.feedback.adminAccountsOwnerOnly",
  PRIVILEGED_USER_MODIFICATION_FORBIDDEN: "admin.feedback.adminAccountsOwnerOnly",
  CLUB_EXISTS: "admin.error.clubExists",
};

const STATUS_KEYS: Record<number, string> = {
  401: "admin.error.session",
  403: "admin.error.forbidden",
  404: "admin.error.notFound",
  409: "admin.error.conflict",
  422: "admin.error.validation",
  429: "admin.error.rateLimited",
};

/** Formadakı yoxlamanın xətası — mətn yox, açar daşıyır. */
export class AdminInputError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(key);
    this.name = "AdminInputError";
    this.key = key;
  }
}

export function adminErrorKeyFor(status: number, code: string | undefined, fallback: string): string {
  if (code && CODE_KEYS[code]) return CODE_KEYS[code];
  return STATUS_KEYS[status] ?? fallback;
}

export function adminErrorKey(error: unknown, fallback = "admin.error.generic"): string {
  if (error instanceof AdminInputError) return error.key;
  if (error instanceof ApiError) return adminErrorKeyFor(error.status, error.code, fallback);
  return fallback;
}

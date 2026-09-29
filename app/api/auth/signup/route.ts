import type { RegisterInput } from "../../../data/user";
import { checkRateLimit } from "../../../lib/api/rate-limit";
import { apiError, apiSuccess, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import {
  getRemoteCredentialCookieOptions,
  mapRemoteUserToProfile,
  remoteCredentialCookie,
  requestRemoteApi,
  type RemoteApiUser,
} from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const rateLimit = checkRateLimit(request, { key: "auth:signup", limit: 5, windowMs: 30 * 60_000 });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Qısa müddətdə çox hesab yaratma cəhdi edildi. Sonra yenidən yoxla." } },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }

    const input = await readJsonBody<RegisterInput>(request);
    const result = await requestRemoteApi<{ token?: string; user: RemoteApiUser; requiresApproval?: boolean; requiresEmailVerification?:boolean; emailDeliveryPending?:boolean; emailCodeRequired?: boolean; challenge?: string; emailHint?: string }>(
      "/api/auth/signup",
      { method: "POST", body: input },
    );
    const requiresApproval = Boolean(result.requiresApproval);
    const requiresEmailVerification = Boolean(result.requiresEmailVerification);
    const response = apiSuccess({
      user: result.token ? mapRemoteUserToProfile(result.user) : null,
      requiresApproval,
      requiresEmailVerification,
      emailDeliveryPending: Boolean(result.emailDeliveryPending),
      ...(result.emailCodeRequired ? { emailCodeRequired: true, challenge: result.challenge, emailHint: result.emailHint } : {}),
    }, 201);
    if (result.token) {
      response.cookies.set(
        remoteCredentialCookie.name,
        result.token,
        getRemoteCredentialCookieOptions(request),
      );
    }
    return response;
  } catch (error) {
    return apiError(error);
  }
}

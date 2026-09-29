import { checkRateLimit } from "../../../../lib/api/rate-limit";
import { apiError, apiSuccess, readJsonBody } from "../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../lib/api/security";
import {
  getRemoteCredentialCookieOptions,
  mapRemoteUserToProfile,
  remoteCredentialCookie,
  requestRemoteApi,
  type RemoteApiUser,
} from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/**
 * Girişin (və qeydiyyatın) ikinci mərhələsi: e-poçta gələn 6 rəqəmli kod.
 * Sessiya kukisi YALNIZ burada, kod təsdiqlənəndən sonra qoyulur.
 */
export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const rateLimit = checkRateLimit(request, { key: "auth:login-email-code", limit: 15, windowMs: 15 * 60_000 });
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Çox sayda cəhd edildi. Bir qədər sonra yenidən yoxla." } },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
    const input = await readJsonBody<{ challenge?: unknown; code?: unknown }>(request);
    const result = await requestRemoteApi<{ token?: string; user: RemoteApiUser; requiresApproval?: boolean }>("/api/auth/login/email-code", {
      method: "POST",
      body: { challenge: input.challenge, code: input.code },
    });
    const response = apiSuccess({
      user: result.token ? mapRemoteUserToProfile(result.user) : null,
      requiresApproval: Boolean(result.requiresApproval),
    });
    if (result.token) response.cookies.set(remoteCredentialCookie.name, result.token, getRemoteCredentialCookieOptions(request));
    return response;
  } catch (error) {
    return apiError(error);
  }
}

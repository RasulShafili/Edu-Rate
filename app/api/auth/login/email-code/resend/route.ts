import { apiError, apiSuccess, readJsonBody } from "../../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../../lib/api/security";
import { requestRemoteApi } from "../../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/** Kodu yenidən göndər (backend 60 saniyə və bilet başına 5 dəfə limit qoyur). */
export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const input = await readJsonBody<{ challenge?: unknown }>(request);
    const result = await requestRemoteApi<{ emailHint: string; retryAfter: number }>("/api/auth/login/email-code/resend", {
      method: "POST",
      body: { challenge: input.challenge },
    });
    return apiSuccess({ emailHint: result.emailHint, retryAfter: result.retryAfter });
  } catch (error) {
    return apiError(error);
  }
}

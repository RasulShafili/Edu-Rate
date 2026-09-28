import { ApiHttpError, apiError, apiSuccess, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import {
  mapRemoteUserToProfile,
  readRemoteCredentialToken,
  requestRemoteApi,
  type RemoteApiUser,
} from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/** Yenilənmiş İstifadə şərtləri və Məxfilik siyasətinin qəbulu. */
export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Davam etmək üçün daxil ol.");
    const input = await readJsonBody<{ accepted?: boolean; version?: string }>(request);
    const result = await requestRemoteApi<{ user: RemoteApiUser }>("/api/auth/legal-consent", {
      method: "POST",
      token,
      body: { accepted: input.accepted === true, version: String(input.version ?? "") },
    });
    return apiSuccess({ user: mapRemoteUserToProfile(result.user) });
  } catch (error) {
    return apiError(error);
  }
}

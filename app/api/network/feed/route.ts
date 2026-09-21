import { ApiHttpError, apiError, apiSuccess, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

/**
 * Tələbə paylaşımı göndərmək.
 *
 * Backend-də `POST /api/network/feed` çoxdan var idi və lent "Tələbə paylaşımı"
 * kartlarını göstərirdi, amma interfeysdən ona heç bir yol yox idi: nə bu BFF
 * marşrutu, nə də forma mövcud idi. Yəni funksiya yalnız API səviyyəsində
 * işləyirdi.
 */
export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Paylaşım göndərmək üçün daxil ol.");
    const body = await readJsonBody<unknown>(request);
    return apiSuccess(await requestRemoteApi("/api/network/feed", { method: "POST", body, token }), 202);
  } catch (error) {
    return apiError(error);
  }
}

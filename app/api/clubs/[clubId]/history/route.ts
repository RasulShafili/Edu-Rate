import { ApiHttpError, apiError, apiSuccess, readJsonBody } from "../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ clubId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Tarixçəni idarə etmək üçün daxil ol.");
    const { clubId } = await context.params;
    const body = await readJsonBody<unknown>(request);
    return apiSuccess(await requestRemoteApi(`/api/clubs/${encodeURIComponent(clubId)}/history`, { method: "POST", body, token }), 201);
  } catch (error) {
    return apiError(error);
  }
}

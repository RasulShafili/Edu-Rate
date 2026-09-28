import { ApiHttpError, apiError, apiSuccess } from "../../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ clubId: string; entryId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Tarixçəni idarə etmək üçün daxil ol.");
    const { clubId, entryId } = await context.params;
    return apiSuccess(await requestRemoteApi(`/api/clubs/${encodeURIComponent(clubId)}/history/${encodeURIComponent(entryId)}`, { method: "DELETE", token }));
  } catch (error) {
    return apiError(error);
  }
}

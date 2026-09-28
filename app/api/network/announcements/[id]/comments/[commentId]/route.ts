import { ApiHttpError, apiError, apiSuccess } from "../../../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Şərhi silmək üçün hesaba daxil ol.");
    const { id, commentId } = await context.params;
    return apiSuccess(await requestRemoteApi(`/api/network/announcements/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE", token }));
  } catch (error) {
    return apiError(error);
  }
}

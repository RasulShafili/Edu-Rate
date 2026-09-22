import { ApiHttpError, apiError, apiNoContent } from "../../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; answerId: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Bu əməliyyat üçün daxil ol.");
    const { id, answerId } = await context.params;
    await requestRemoteApi(
      `/api/questions/${encodeURIComponent(id)}/answers/${encodeURIComponent(answerId)}`,
      { method: "DELETE", token },
    );
    return apiNoContent();
  } catch (error) {
    return apiError(error);
  }
}

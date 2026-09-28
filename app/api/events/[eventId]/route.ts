import { ApiHttpError, apiError, apiNoContent, apiSuccess, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ eventId: string }> };

/**
 * Yaradanın öz tədbirini redaktə etməsi və silməsi. Backend bunu dəstəkləyirdi,
 * amma BFF marşrutu yox idi — müəllim göndərdiyi tədbirdə səhvi düzəldə və ya
 * onu geri götürə bilmirdi.
 */
export async function PATCH(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Tədbiri dəyişmək üçün hesaba daxil ol.");
    const { eventId } = await context.params;
    const body = await readJsonBody<unknown>(request);
    return apiSuccess(await requestRemoteApi(`/api/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body, token }));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Tədbiri silmək üçün hesaba daxil ol.");
    const { eventId } = await context.params;
    await requestRemoteApi(`/api/events/${encodeURIComponent(eventId)}`, { method: "DELETE", token });
    return apiNoContent();
  } catch (error) {
    return apiError(error);
  }
}

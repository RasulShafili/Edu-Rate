import { ApiHttpError, apiError, apiSuccess, readJsonBody } from "../../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

/** Elan şərhləri: oxumaq hamıya açıqdır (token varsa "mənim şərhim" işarələnir). */
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const token = readRemoteCredentialToken(request);
    return apiSuccess(await requestRemoteApi(`/api/network/announcements/${encodeURIComponent(id)}/comments`, { token }));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Şərh yazmaq üçün hesaba daxil ol.");
    const { id } = await context.params;
    const body = await readJsonBody<unknown>(request);
    return apiSuccess(await requestRemoteApi(`/api/network/announcements/${encodeURIComponent(id)}/comments`, { method: "POST", body, token }), 201);
  } catch (error) {
    return apiError(error);
  }
}

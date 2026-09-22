import { apiError, apiSuccess, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import { getRequestIdentity } from "../../../lib/auth/request-identity";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/** Mentorun kataloqdakı praktik məlumatları (əlçatanlıq, format, dillər, təcrübə). */
export async function PATCH(request: Request) {
  try {
    assertTrustedMutation(request);
    const identity = await getRequestIdentity(request);
    const token = readRemoteCredentialToken(request);
    if (!identity || !token) return Response.json({ error: { code: "AUTH_REQUIRED", message: "Daxil olmaq tələb olunur." } }, { status: 401 });
    if (identity.role !== "mentor" && identity.role !== "teacher") {
      return Response.json({ error: { code: "MENTOR_REQUIRED", message: "Bu əməliyyat yalnız təsdiqlənmiş mentor üçündür." } }, { status: 403 });
    }
    const body = await readJsonBody<unknown>(request);
    return apiSuccess(await requestRemoteApi<unknown>("/api/workspace/mentor-profile", { method: "PATCH", body, token }));
  } catch (error) {
    return apiError(error);
  }
}

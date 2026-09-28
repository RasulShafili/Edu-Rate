import { ApiHttpError, apiError, apiSuccess } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };

/** Şəxsi bildirişlər: GET siyahı, PATCH /:id/read, POST /read-all. */
async function handle(request: Request, context: Context) {
  try {
    if (request.method !== "GET") assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Bildirişlər üçün hesaba daxil ol.");
    const { path = [] } = await context.params;
    const method = request.method as "GET" | "POST" | "PATCH";
    const query = new URL(request.url).searchParams.toString();
    const suffix = path.map(encodeURIComponent).join("/");
    const data = await requestRemoteApi<unknown>(
      `/api/notifications${suffix ? `/${suffix}` : ""}${query ? `?${query}` : ""}`,
      { method, token, body: method === "GET" ? undefined : {} },
    );
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;

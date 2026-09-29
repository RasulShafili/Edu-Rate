import { ApiHttpError, apiError, apiNoContent, readJsonBody } from "../../../lib/api/http";
import { assertTrustedMutation } from "../../../lib/api/security";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/** Daxil olmuş istifadəçinin şifrə dəyişməsi: cari şifrə backend-də yoxlanılır. */
export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Şifrəni dəyişmək üçün daxil ol.");
    const input = await readJsonBody<{ currentPassword?: unknown; newPassword?: unknown }>(request);
    await requestRemoteApi<void>("/api/auth/password/change", {
      method: "POST",
      token,
      body: { currentPassword: String(input.currentPassword ?? ""), newPassword: String(input.newPassword ?? "") },
    });
    return apiNoContent();
  } catch (error) {
    return apiError(error);
  }
}

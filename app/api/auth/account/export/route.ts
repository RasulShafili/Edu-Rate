import { NextResponse } from "next/server";
import { ApiHttpError, apiError } from "../../../../lib/api/http";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

/** "Məlumatlarımı yüklə": istifadəçinin öz məlumatları fayl kimi. */
export async function GET(request: Request) {
  try {
    const token = readRemoteCredentialToken(request);
    if (!token) throw new ApiHttpError(401, "UNAUTHENTICATED", "Məlumatlarını yükləmək üçün daxil ol.");
    const data = await requestRemoteApi<unknown>("/api/auth/account/export", { token, timeoutMs: 20_000 });
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="edurate-melumatlarim-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

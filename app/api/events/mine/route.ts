import { ApiHttpError, apiError, apiSuccess } from "../../../lib/api/http";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

type MyEvent = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  createdAt: string;
};

/** Müəllimin göndərdiyi tədbirlər — ictimai kataloq yalnız dərc olunanı göstərir. */
export async function GET(request: Request) {
  try {
    const token = readRemoteCredentialToken(request);
    if (!token) {
      throw new ApiHttpError(401, "UNAUTHENTICATED", "Göndərdiyin tədbirləri görmək üçün hesaba daxil ol.");
    }

    return apiSuccess(await requestRemoteApi<MyEvent[]>("/api/events/mine", { token }));
  } catch (error) {
    return apiError(error);
  }
}

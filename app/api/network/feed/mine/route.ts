import { ApiHttpError, apiError, apiSuccess } from "../../../../lib/api/http";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

type MyFeedPost = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

/** İstifadəçinin lent paylaşımları — ictimai lent yalnız dərc olunanı göstərir. */
export async function GET(request: Request) {
  try {
    const token = readRemoteCredentialToken(request);
    if (!token) {
      throw new ApiHttpError(401, "UNAUTHENTICATED", "Paylaşımlarını görmək üçün hesaba daxil ol.");
    }

    return apiSuccess(await requestRemoteApi<MyFeedPost[]>("/api/network/feed/mine", { token }));
  } catch (error) {
    return apiError(error);
  }
}

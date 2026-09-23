import { ApiHttpError, apiError, apiSuccess } from "../../../../lib/api/http";
import { readRemoteCredentialToken, requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic = "force-dynamic";

type MyAnnouncement = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
};

/** İstifadəçinin göndərdiyi elanlar — lövhə yalnız dərc olunanı göstərir. */
export async function GET(request: Request) {
  try {
    const token = readRemoteCredentialToken(request);
    if (!token) {
      throw new ApiHttpError(401, "UNAUTHENTICATED", "Göndərdiyin elanları görmək üçün hesaba daxil ol.");
    }

    return apiSuccess(await requestRemoteApi<MyAnnouncement[]>("/api/network/announcements/mine", { token }));
  } catch (error) {
    return apiError(error);
  }
}

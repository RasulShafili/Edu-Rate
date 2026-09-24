import { ApiHttpError,apiError,apiNoContent,apiSuccess,readJsonBody } from "../../../../lib/api/http";
import { assertTrustedMutation } from "../../../../lib/api/security";
import { readRemoteCredentialToken,requestRemoteApi } from "../../../../lib/auth/remote-credential";

export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
async function handle(request:Request,context:Context){try{if(request.method!=="GET")assertTrustedMutation(request);const {path}=await context.params;const allowed=new Set(["verify-email/request","verify-email/confirm","password/forgot","password/verify-code","password/reset","sessions","2fa","2fa/setup","2fa/enable","2fa/disable","2fa/recovery-codes"]);const joined=path.join("/");if(!allowed.has(joined)&&!(path[0]==="sessions"&&path.length===2))throw new ApiHttpError(404,"NOT_FOUND","Sorğu tapılmadı.");const method=request.method as "GET"|"POST"|"DELETE";const token=readRemoteCredentialToken(request);const body=method==="POST"&&request.body?await readJsonBody<unknown>(request):undefined;const data=await requestRemoteApi<unknown>(`/api/auth/${path.map(encodeURIComponent).join("/")}`,{method,body,token});return data===undefined?apiNoContent():apiSuccess(data,method==="POST"?202:200);}catch(error){return apiError(error);}}
export const GET=handle;export const POST=handle;export const DELETE=handle;

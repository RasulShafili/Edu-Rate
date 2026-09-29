import {
  ApiError,
  createApiClient,
} from "../api/client";
import type {
  AuthGateway,
  EmailCodeResult,
  ProfileUpdateInput,
  RegisterInput,
  RegisterResult,
  SignInInput,
  SignInResult,
  TwoFactorSignInResult,
  UserProfile,
} from "../../data/user";

const api = createApiClient({ baseUrl: "/api" });

type SessionPayload = { user: UserProfile };

export const credentialAuthGateway: AuthGateway = {
  async signIn(input: SignInInput): Promise<SignInResult> {
    const result = await api.post<{ user?: UserProfile; twoFactorRequired?: boolean; emailCodeRequired?: boolean; challenge?: string; emailHint?: string }, SignInInput>("/auth/login", input);
    if (result.twoFactorRequired && result.challenge) return { twoFactorChallenge: result.challenge };
    if (result.emailCodeRequired && result.challenge) return { emailChallenge: { challenge: result.challenge, emailHint: result.emailHint ?? "" } };
    if (!result.user) throw new ApiError("Invalid sign-in response.", { status: 502, code: "INVALID_RESPONSE" });
    return { user: result.user };
  },
  async completeTwoFactor(challenge: string, code: string) {
    return api.post<TwoFactorSignInResult, { challenge: string; code: string }>("/auth/login/2fa", { challenge, code });
  },
  async completeEmailCode(challenge: string, code: string) {
    return api.post<EmailCodeResult, { challenge: string; code: string }>("/auth/login/email-code", { challenge, code });
  },
  async resendEmailCode(challenge: string) {
    return api.post<{ emailHint: string; retryAfter: number }, { challenge: string }>("/auth/login/email-code/resend", { challenge });
  },
  async register(input: RegisterInput) {
    const result = await api.post<{ user: UserProfile | null; requiresApproval: boolean; requiresEmailVerification?:boolean; emailDeliveryPending?:boolean; emailCodeRequired?: boolean; challenge?: string; emailHint?: string }, RegisterInput>("/auth/signup", input);
    const { emailCodeRequired, challenge, emailHint, ...rest } = result;
    return {
      ...rest,
      ...(emailCodeRequired && challenge ? { emailChallenge: { challenge, emailHint: emailHint ?? "" } } : {}),
      accountType: input.accountType,
    } satisfies RegisterResult;
  },
  async signOut() {
    await api.post<void, Record<string, never>>("/auth/logout", {});
  },
  async updateProfile(_profile: UserProfile, input: ProfileUpdateInput) {
    const result = await api.patch<SessionPayload, ProfileUpdateInput>("/auth/profile", input);
    return result.user;
  },
};

export async function getCredentialSession(): Promise<UserProfile | null> {
  try {
    const result = await api.get<SessionPayload>("/auth/session");
    return result.user;
  } catch (error) {
    if(error instanceof ApiError&&error.status===401)return null;
    throw error;
  }
}

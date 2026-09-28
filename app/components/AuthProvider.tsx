"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  type AuthGateway,
  type ProfileUpdateInput,
  type RegisterInput,
  type RegisterResult,
  type SignInInput,
  type SignInResult,
  type TwoFactorSignInResult,
  type UserProfile,
} from "../data/user";
import {
  isAdminAccessRole,
  type AdminAccessRole,
} from "../lib/auth/admin-role";
import { credentialAuthGateway, getCredentialSession } from "../lib/auth/credential-api";

type AuthStatus = "idle" | "submitting";

type AuthContextValue = {
  user: UserProfile | null;
  /** Server sessiyanı yoxlaya bilmədi; brauzer yoxlayana qədər "daxil ol" göstərilmir. */
  sessionPending: boolean;
  status: AuthStatus;
  credentialAuthAvailable: boolean;
  signOutHref: string | null;
  isAdmin: boolean;
  adminRole: AdminAccessRole | null;
  signIn: (input: SignInInput) => Promise<SignInResult>;
  completeTwoFactor: (challenge: string, code: string) => Promise<TwoFactorSignInResult>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<UserProfile>;
  /** Server yenilənmiş istifadəçi qaytaranda (məs. hüquqi razılıqdan sonra). */
  replaceUser: (next: UserProfile) => void;
};

type AuthProviderProps = PropsWithChildren<{
  gateway?: AuthGateway;
  initialUser?: UserProfile | null;
  initialSessionPending?: boolean;
  signOutHref?: string | null;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

export const AUTH_PROVIDER_UNAVAILABLE_CODE = "AUTH_PROVIDER_NOT_CONFIGURED";

export function AuthProvider({
  children,
  gateway,
  initialUser = null,
  initialSessionPending = false,
  signOutHref = null,
}: AuthProviderProps) {
  const [user, setUser] = useState<UserProfile | null>(initialUser);
  const [sessionPending, setSessionPending] = useState(initialSessionPending);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const activeGateway = gateway ?? credentialAuthGateway;
  const credentialAuthAvailable = !signOutHref;
  const adminRole = isAdminAccessRole(user?.accessRole)
    ? user.accessRole
    : null;

  useEffect(() => {
    let cancelled = false;
    async function hydrateSession(){
      // Backend oyanırsa (server artıq bunu bildirib) daha uzun gözləyirik.
      const attempts=initialSessionPending?6:3;
      for(let attempt=0;attempt<attempts&&!cancelled;attempt+=1){
        try{
          const sessionUser=await getCredentialSession();
          if(!cancelled){setUser(sessionUser);setSessionPending(false);}
          return;
        }catch{
          if(attempt<attempts-1)await new Promise((resolve)=>window.setTimeout(resolve,attempt===0?500:1400));
        }
      }
      if(!cancelled)setSessionPending(false);
    }
    void hydrateSession();
    const restore=()=>void hydrateSession();
    window.addEventListener("online",restore);

    return () => {
      cancelled = true;
      window.removeEventListener("online",restore);
    };
  }, [initialSessionPending]);

  const signIn = useCallback(async (input: SignInInput) => {
    setStatus("submitting");
    try {
      const result = await activeGateway.signIn(input);
      if (result.user) setUser(result.user);
      return result;
    } finally {
      setStatus("idle");
    }
  }, [activeGateway]);

  const completeTwoFactor = useCallback(async (challenge: string, code: string) => {
    setStatus("submitting");
    try {
      const result = await activeGateway.completeTwoFactor(challenge, code);
      setUser(result.user);
      return result;
    } finally {
      setStatus("idle");
    }
  }, [activeGateway]);

  const register = useCallback(async (input: RegisterInput) => {
    setStatus("submitting");
    try {
      const result = await activeGateway.register(input);
      if (result.user) setUser(result.user);
      return result;
    } finally {
      setStatus("idle");
    }
  }, [activeGateway]);

  const signOut = useCallback(async () => {
    setStatus("submitting");
    try {
      await activeGateway.signOut();
      setUser(null);
    } finally {
      setStatus("idle");
    }
  }, [activeGateway]);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    if (!user) throw new Error("AUTH_REQUIRED");

    setStatus("submitting");
    try {
      const nextUser = await activeGateway.updateProfile(user, input);
      setUser(nextUser);
      return nextUser;
    } finally {
      setStatus("idle");
    }
  }, [activeGateway, user]);

  const value = useMemo<AuthContextValue>(() => ({
    credentialAuthAvailable,
    signOutHref,
    isAdmin: Boolean(adminRole),
    adminRole,
    user,
    sessionPending,
    status,
    signIn,
    completeTwoFactor,
    register,
    signOut,
    updateProfile,
    replaceUser: setUser,
  }), [adminRole, completeTwoFactor, credentialAuthAvailable, register, sessionPending, signIn, signOut, signOutHref, status, updateProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth AuthProvider daxilində istifadə olunmalıdır.");
  }
  return context;
}

export function isAuthProviderUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === AUTH_PROVIDER_UNAVAILABLE_CODE
  );
}

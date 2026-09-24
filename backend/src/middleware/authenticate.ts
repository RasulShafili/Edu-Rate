import type { NextFunction, Request, Response } from "express";
import { findUserById } from "../db/database.js";
import { ApiError } from "../lib/api-error.js";
import { verifyAccessToken } from "../lib/auth.js";
import { isTwoFactorEnabled, resolveSession } from "../db/auth-security.js";
import { env } from "../config/env.js";

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  const authorization = request.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return next(new ApiError(401, "AUTH_REQUIRED", "Daxil olmaq tələb olunur."));
  }

  try {
    const tokenIdentity = verifyAccessToken(token);
    if (tokenIdentity.sessionId) {
      const session=await resolveSession(token);
      if(!session||session.id!==tokenIdentity.sessionId||session.userId!==tokenIdentity.userId){
        return next(new ApiError(401,"SESSION_REVOKED","Sessiya bitib və ya ləğv edilib."));
      }
    }
    const user = await findUserById(tokenIdentity.userId);
    if (!user) {
      return next(new ApiError(401, "SESSION_USER_NOT_FOUND", "Sessiya istifadəçisi tapılmadı."));
    }
    if (user.status !== "Aktiv") {
      return next(new ApiError(403, "ACCOUNT_RESTRICTED", "Hesab aktiv deyil."));
    }

    request.auth = { userId: user.id, role: user.role, sessionId: tokenIdentity.sessionId };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * İstəyə bağlı autentifikasiya: token varsa istifadəçini tanıyır, YOXSA və ya
 * token etibarsızdırsa (vaxtı bitib, sessiya ləğv olunub) sorğu anonim davam
 * edir. Köhnəlmiş kuki ictimai məzmunu bloklamamalıdır.
 */
export async function optionalAuthenticate(request:Request,response:Response,next:NextFunction){
  if(!request.header("authorization"))return next();
  return authenticate(request,response,(error?:unknown)=>{
    if(error)request.auth=undefined;
    next();
  });
}

export function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (!request.auth || !["owner_admin", "admin", "assistant_admin"].includes(request.auth.role)) {
    return next(new ApiError(403, "ADMIN_REQUIRED", "Bu əməliyyat üçün admin icazəsi lazımdır."));
  }

  next();
}

/**
 * Rəhbərlik hesabı ələ keçirilsə bütün platforma ələ keçir; ona görə admin
 * API-si yalnız iki mərhələli girişi aktiv olan hesablara açılır. İstifadəçi
 * yenə daxil olur və 2FA-nı Parametrlərdə qura bilir.
 */
export async function requireAdminTwoFactor(request: Request, _response: Response, next: NextFunction) {
  if (!env.ADMIN_2FA_REQUIRED) return next();
  try {
    if (!request.auth || !(await isTwoFactorEnabled(request.auth.userId))) {
      return next(new ApiError(403, "TWO_FACTOR_REQUIRED", "Rəhbərlik paneli üçün iki mərhələli giriş aktiv olmalıdır."));
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePrimaryAdmin(request: Request, _response: Response, next: NextFunction) {
  if (request.auth?.role !== "admin" && request.auth?.role !== "owner_admin") {
    return next(
      new ApiError(
        403,
        "PRIMARY_ADMIN_REQUIRED",
        "Bu əməliyyat yalnız əsas admin üçün əlçatandır.",
      ),
    );
  }

  next();
}

export function requireOwnerAdmin(request: Request, _response: Response, next: NextFunction) {
  if (request.auth?.role !== "owner_admin") {
    return next(new ApiError(403, "OWNER_ADMIN_REQUIRED", "Bu əməliyyat yalnız platforma sahibi üçün əlçatandır."));
  }
  next();
}

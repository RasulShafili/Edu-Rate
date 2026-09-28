import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { databasePool } from "./database.js";

export type AuthPurpose = "verify_email" | "reset_password" | "activate_account";
type MemorySession = { id:string; userId:string; hash:string; expiresAt:number; revokedAt?:number; userAgent:string; ipAddress:string; createdAt:string; lastSeenAt:string };
type MemoryAction = { userId:string; purpose:AuthPurpose; hash:string; expiresAt:number; used:boolean };
const memorySessions = new Map<string, MemorySession>();
const memoryActions = new Map<string, MemoryAction>();

const digest = (value:string) => createHash("sha256").update(value).digest("hex");
const opaqueToken = () => randomBytes(32).toString("base64url");

export async function registerSessionToken(userId:string,token:string,id:string,userAgent="",ipAddress=""){
  const tokenHash=digest(token);const expiresAt=new Date(Date.now()+30*24*60*60*1000);
  if(!databasePool){memorySessions.set(tokenHash,{id,userId,hash:tokenHash,expiresAt:expiresAt.getTime(),userAgent:userAgent.slice(0,300),ipAddress:ipAddress.slice(0,80),createdAt:new Date().toISOString(),lastSeenAt:new Date().toISOString()});return;}
  await databasePool.query("INSERT INTO auth_sessions(id,user_id,token_hash,user_agent,ip_address,expires_at) VALUES($1,$2,$3,$4,$5,$6)",[id,userId,tokenHash,userAgent.slice(0,300),ipAddress.slice(0,80),expiresAt]);
}

export async function resolveSession(token:string){
  const tokenHash=digest(token);
  if(!databasePool){const item=memorySessions.get(tokenHash);if(!item||item.revokedAt||item.expiresAt<=Date.now())return null;item.lastSeenAt=new Date().toISOString();return {id:item.id,userId:item.userId};}
  const result=await databasePool.query(`UPDATE auth_sessions SET last_seen_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>NOW() RETURNING id,user_id`,[tokenHash]);
  return result.rows[0]?{id:String(result.rows[0].id),userId:String(result.rows[0].user_id)}:null;
}

export async function listSessions(userId:string,currentId?:string){
  if(!databasePool)return [...memorySessions.values()].filter((x)=>x.userId===userId&&!x.revokedAt&&x.expiresAt>Date.now()).map((x)=>({id:x.id,userAgent:x.userAgent,ipAddress:x.ipAddress,createdAt:x.createdAt,lastSeenAt:x.lastSeenAt,current:x.id===currentId}));
  const result=await databasePool.query("SELECT id,user_agent,ip_address,created_at,last_seen_at FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>NOW() ORDER BY last_seen_at DESC",[userId]);
  return result.rows.map((x)=>({id:String(x.id),userAgent:String(x.user_agent),ipAddress:String(x.ip_address),createdAt:new Date(x.created_at).toISOString(),lastSeenAt:new Date(x.last_seen_at).toISOString(),current:String(x.id)===currentId}));
}

export async function revokeSession(userId:string,id:string){if(!databasePool){const item=[...memorySessions.values()].find((x)=>x.userId===userId&&x.id===id);if(!item)return false;item.revokedAt=Date.now();return true;}const r=await databasePool.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL",[id,userId]);return Boolean(r.rowCount);}
export async function revokeAllSessions(userId:string,exceptId?:string){if(!databasePool){for(const item of memorySessions.values())if(item.userId===userId&&item.id!==exceptId)item.revokedAt=Date.now();return;}await databasePool.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id<>$2)",[userId,exceptId??null]);}

export async function createActionToken(userId:string,purpose:AuthPurpose,ttlMs:number){const token=opaqueToken();const hash=digest(token);const expiresAt=new Date(Date.now()+ttlMs);if(!databasePool){memoryActions.set(hash,{userId,purpose,hash,expiresAt:expiresAt.getTime(),used:false});return token;}await databasePool.query("UPDATE auth_action_tokens SET used_at=NOW() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",[userId,purpose]);await databasePool.query("INSERT INTO auth_action_tokens(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)",[randomUUID(),userId,purpose,hash,expiresAt]);return token;}
export async function consumeActionToken(token:string,purpose:AuthPurpose){const hash=digest(token);if(!databasePool){const item=memoryActions.get(hash);if(!item||item.used||item.purpose!==purpose||item.expiresAt<=Date.now())return null;item.used=true;return item.userId;}const r=await databasePool.query("UPDATE auth_action_tokens SET used_at=NOW() WHERE token_hash=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>NOW() RETURNING user_id",[hash,purpose]);return r.rows[0]?String(r.rows[0].user_id):null;}

export async function createActionCode(userId:string,purpose:AuthPurpose,ttlMs:number){
  const code=String(randomInt(0,1_000_000)).padStart(6,"0");
  const hash=digest(`${userId}:${purpose}:${code}`);
  const expiresAt=new Date(Date.now()+ttlMs);
  if(!databasePool){
    for(const item of memoryActions.values())if(item.userId===userId&&item.purpose===purpose&&!item.used)item.used=true;
    memoryActions.set(hash,{userId,purpose,hash,expiresAt:expiresAt.getTime(),used:false});
    return code;
  }
  await databasePool.query("UPDATE auth_action_tokens SET used_at=NOW() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",[userId,purpose]);
  await databasePool.query("INSERT INTO auth_action_tokens(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,$5)",[randomUUID(),userId,purpose,hash,expiresAt]);
  return code;
}

export async function consumeActionCode(userId:string,code:string,purpose:AuthPurpose){
  const hash=digest(`${userId}:${purpose}:${code}`);
  if(!databasePool){const item=memoryActions.get(hash);if(!item||item.userId!==userId||item.used||item.purpose!==purpose||item.expiresAt<=Date.now())return false;item.used=true;return true;}
  const result=await databasePool.query("UPDATE auth_action_tokens SET used_at=NOW() WHERE user_id=$1 AND token_hash=$2 AND purpose=$3 AND used_at IS NULL AND expires_at>NOW() RETURNING id",[userId,hash,purpose]);
  return Boolean(result.rowCount);
}

/* ---------- Hesab üzrə cəhd limiti ---------- */

type MemoryAttempt = { failures:number; windowStartedAt:number; lockedUntil:number|null };
const memoryAttempts = new Map<string, MemoryAttempt>();

/** Kilid bitənə qədər qalan saniyə, kilid yoxdursa 0. */
export async function getLockRemainingSeconds(key:string){
  const now=Date.now();
  if(!databasePool){const item=memoryAttempts.get(key);return item?.lockedUntil&&item.lockedUntil>now?Math.ceil((item.lockedUntil-now)/1000):0;}
  const result=await databasePool.query("SELECT locked_until FROM auth_attempts WHERE key=$1 AND locked_until > NOW()",[key]);
  return result.rows[0]?Math.max(1,Math.ceil((new Date(result.rows[0].locked_until).getTime()-now)/1000)):0;
}

/**
 * Uğursuz cəhdi sayır. `windowMs` ərzində `limit` uğursuzluqdan sonra açar
 * `lockMs` müddətinə kilidlənir. Qaytarır: kilidləndisə qalan saniyə, yoxsa 0.
 */
export async function registerFailedAttempt(key:string,options:{limit:number;windowMs:number;lockMs:number}){
  const now=Date.now();
  if(!databasePool){
    const current=memoryAttempts.get(key);
    const item=!current||current.windowStartedAt+options.windowMs<=now?{failures:0,windowStartedAt:now,lockedUntil:null}:current;
    item.failures+=1;
    if(item.failures>=options.limit){item.lockedUntil=now+options.lockMs;item.failures=0;item.windowStartedAt=now;}
    memoryAttempts.set(key,item);
    return item.lockedUntil&&item.lockedUntil>now?Math.ceil(options.lockMs/1000):0;
  }
  const result=await databasePool.query(`
    INSERT INTO auth_attempts(key,failures,window_started_at) VALUES($1,1,NOW())
    ON CONFLICT (key) DO UPDATE SET
      failures=CASE WHEN auth_attempts.window_started_at + ($2::bigint * INTERVAL '1 millisecond') <= NOW() THEN 1 ELSE auth_attempts.failures+1 END,
      window_started_at=CASE WHEN auth_attempts.window_started_at + ($2::bigint * INTERVAL '1 millisecond') <= NOW() THEN NOW() ELSE auth_attempts.window_started_at END
    RETURNING failures`,[key,options.windowMs]);
  if(Number(result.rows[0]?.failures??0)<options.limit)return 0;
  await databasePool.query("UPDATE auth_attempts SET failures=0,window_started_at=NOW(),locked_until=NOW()+($2::bigint * INTERVAL '1 millisecond') WHERE key=$1",[key,options.lockMs]);
  return Math.ceil(options.lockMs/1000);
}

export async function clearAttempts(key:string){
  if(!databasePool){memoryAttempts.delete(key);return;}
  await databasePool.query("DELETE FROM auth_attempts WHERE key=$1",[key]);
}

/* ---------- İki mərhələli giriş (TOTP) ---------- */

type TwoFactorRecord = { secretEncrypted:string; enabledAt:string|null; lastUsedStep:number|null };
const memoryTwoFactor = new Map<string, TwoFactorRecord>();
const memoryRecoveryCodes = new Map<string, { userId:string; hash:string; used:boolean }>();
const memoryChallenges = new Map<string, { id:string; userId:string; expiresAt:number; used:boolean }>();

export async function getTwoFactor(userId:string):Promise<TwoFactorRecord|null>{
  if(!databasePool)return memoryTwoFactor.get(userId)??null;
  const result=await databasePool.query("SELECT secret_encrypted,enabled_at,last_used_step FROM user_two_factor WHERE user_id=$1",[userId]);
  const row=result.rows[0];
  return row?{secretEncrypted:String(row.secret_encrypted),enabledAt:row.enabled_at?new Date(row.enabled_at).toISOString():null,lastUsedStep:row.last_used_step===null?null:Number(row.last_used_step)}:null;
}

export async function isTwoFactorEnabled(userId:string){
  return Boolean((await getTwoFactor(userId))?.enabledAt);
}

/** Aktiv 2FA-nı əvəz etmir: yalnız hələ təsdiqlənməmiş (və ya olmayan) qeydi yazır. */
export async function savePendingTwoFactor(userId:string,secretEncrypted:string){
  if(!databasePool){const current=memoryTwoFactor.get(userId);if(current?.enabledAt)return false;memoryTwoFactor.set(userId,{secretEncrypted,enabledAt:null,lastUsedStep:null});return true;}
  const result=await databasePool.query(`
    INSERT INTO user_two_factor(user_id,secret_encrypted) VALUES($1,$2)
    ON CONFLICT (user_id) DO UPDATE SET secret_encrypted=EXCLUDED.secret_encrypted,last_used_step=NULL,created_at=NOW()
    WHERE user_two_factor.enabled_at IS NULL`,[userId,secretEncrypted]);
  return Boolean(result.rowCount);
}

/**
 * İşlənmiş TOTP addımını atomik qeyd edir; eyni və ya köhnə addım ikinci dəfə
 * qəbul edilmir (paralel iki sorğu eyni kodu işlədə bilməz).
 */
export async function markTwoFactorStepUsed(userId:string,step:number,activate=false){
  if(!databasePool){
    const item=memoryTwoFactor.get(userId);
    if(!item||(item.lastUsedStep!==null&&item.lastUsedStep>=step))return false;
    item.lastUsedStep=step;if(activate&&!item.enabledAt)item.enabledAt=new Date().toISOString();
    return true;
  }
  const result=await databasePool.query(`
    UPDATE user_two_factor SET last_used_step=$2, enabled_at=CASE WHEN $3::boolean THEN COALESCE(enabled_at,NOW()) ELSE enabled_at END
    WHERE user_id=$1 AND (last_used_step IS NULL OR last_used_step < $2)`,[userId,step,activate]);
  return Boolean(result.rowCount);
}

export async function deleteTwoFactor(userId:string){
  if(!databasePool){memoryTwoFactor.delete(userId);for(const [key,item] of memoryRecoveryCodes)if(item.userId===userId)memoryRecoveryCodes.delete(key);return;}
  await databasePool.query("DELETE FROM user_two_factor WHERE user_id=$1",[userId]);
  await databasePool.query("DELETE FROM auth_recovery_codes WHERE user_id=$1",[userId]);
}

export async function replaceRecoveryCodes(userId:string,codes:string[]){
  const hashes=codes.map((code)=>digest(`${userId}:recovery:${code}`));
  if(!databasePool){
    for(const [key,item] of memoryRecoveryCodes)if(item.userId===userId)memoryRecoveryCodes.delete(key);
    for(const hash of hashes)memoryRecoveryCodes.set(hash,{userId,hash,used:false});
    return;
  }
  await databasePool.query("DELETE FROM auth_recovery_codes WHERE user_id=$1",[userId]);
  for(const hash of hashes)await databasePool.query("INSERT INTO auth_recovery_codes(id,user_id,code_hash) VALUES($1,$2,$3)",[randomUUID(),userId,hash]);
}

export async function consumeRecoveryCode(userId:string,code:string){
  const hash=digest(`${userId}:recovery:${code}`);
  if(!databasePool){const item=memoryRecoveryCodes.get(hash);if(!item||item.userId!==userId||item.used)return false;item.used=true;return true;}
  const result=await databasePool.query("UPDATE auth_recovery_codes SET used_at=NOW() WHERE user_id=$1 AND code_hash=$2 AND used_at IS NULL RETURNING id",[userId,hash]);
  return Boolean(result.rowCount);
}

export async function countRecoveryCodes(userId:string){
  if(!databasePool)return [...memoryRecoveryCodes.values()].filter((item)=>item.userId===userId&&!item.used).length;
  const result=await databasePool.query("SELECT COUNT(*)::int AS total FROM auth_recovery_codes WHERE user_id=$1 AND used_at IS NULL",[userId]);
  return Number(result.rows[0]?.total??0);
}

/** Şifrə düzgündür, kod gözlənilir: 5 dəqiqəlik birdəfəlik bilet (sessiya deyil). */
export async function createLoginChallenge(userId:string){
  const token=opaqueToken();const hash=digest(token);const id=randomUUID();const expiresAt=new Date(Date.now()+5*60*1000);
  if(!databasePool){memoryChallenges.set(hash,{id,userId,expiresAt:expiresAt.getTime(),used:false});return token;}
  await databasePool.query("INSERT INTO auth_login_challenges(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,$4)",[id,userId,hash,expiresAt]);
  return token;
}

export async function findLoginChallenge(token:string){
  const hash=digest(token);
  if(!databasePool){const item=memoryChallenges.get(hash);return item&&!item.used&&item.expiresAt>Date.now()?{id:item.id,userId:item.userId}:null;}
  const result=await databasePool.query("SELECT id,user_id FROM auth_login_challenges WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW()",[hash]);
  return result.rows[0]?{id:String(result.rows[0].id),userId:String(result.rows[0].user_id)}:null;
}

export async function consumeLoginChallenge(id:string){
  if(!databasePool){for(const item of memoryChallenges.values())if(item.id===id&&!item.used){item.used=true;return true;}return false;}
  const result=await databasePool.query("UPDATE auth_login_challenges SET used_at=NOW() WHERE id=$1 AND used_at IS NULL RETURNING id",[id]);
  return Boolean(result.rowCount);
}

export async function cleanupExpiredSecurityData(){
  if(!databasePool){
    for(const [hash,item] of memorySessions)if(item.expiresAt<Date.now()-7*24*60*60*1000)memorySessions.delete(hash);
    for(const [hash,item] of memoryActions)if(item.expiresAt<Date.now()-24*60*60*1000)memoryActions.delete(hash);
    for(const [hash,item] of memoryChallenges)if(item.expiresAt<Date.now())memoryChallenges.delete(hash);
    for(const [key,item] of memoryAttempts)if((item.lockedUntil??0)<Date.now()&&item.windowStartedAt<Date.now()-24*60*60*1000)memoryAttempts.delete(key);
    return;
  }
  await databasePool.query("DELETE FROM auth_login_challenges WHERE expires_at < NOW() - INTERVAL '1 day'");
  await databasePool.query("DELETE FROM auth_attempts WHERE (locked_until IS NULL OR locked_until < NOW()) AND window_started_at < NOW() - INTERVAL '1 day'");
  await databasePool.query("DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days' OR revoked_at < NOW() - INTERVAL '30 days'");
  await databasePool.query("DELETE FROM auth_action_tokens WHERE expires_at < NOW() - INTERVAL '1 day' OR used_at < NOW() - INTERVAL '7 days'");
  await databasePool.query("DELETE FROM content_reports WHERE status IN ('resolved','dismissed') AND updated_at < NOW() - INTERVAL '180 days'");
  // Məxfilik siyasətindəki saxlama müddətləri: audit jurnalı 1 il, bağlanmış
  // dəstək müraciətləri 2 il, oxunmuş bildirişlər 180 gün.
  await databasePool.query("DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '365 days'");
  await databasePool.query("DELETE FROM support_tickets WHERE status='resolved' AND updated_at < NOW() - INTERVAL '730 days'");
  await databasePool.query("DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < NOW() - INTERVAL '180 days'");
}

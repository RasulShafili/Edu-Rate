import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { env } from "../config/env.js";

export type UserRole = "student" | "mentor" | "teacher" | "assistant_admin" | "admin" | "owner_admin";
export type UserStatus = "Aktiv" | "Gözləmədə" | "Məhdudlaşdırılıb";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  university: string;
  faculty: string;
  program: string;
  year: string;
  city: string;
  about: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  termsVersion: string | null;
  privacyVersion: string | null;
  legalAcceptedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRecord {
  name: string;
  email: string;
  passwordHash: string;
  university: string;
  faculty: string;
  program?: string;
  role?: UserRole;
  status?: UserStatus;
  emailVerifiedAt?: string | null;
  termsVersion?: string | null;
  privacyVersion?: string | null;
}

export interface UpdateUserRecord {
  name: string;
  university: string;
  faculty: string;
  program: string;
  year: string;
  about: string;
}

// Managed Postgres (Neon, Supabase, Render external) tələb edir TLS. Lokal
// host üçün SSL bağlı qalır; qeyri-lokal host üçün avtomatik aktivləşir.
function shouldUseSsl(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return !["localhost", "127.0.0.1", "::1"].includes(host);
  } catch {
    return false;
  }
}

export const databasePool = env.DATABASE_URL
  ? new Pool({
      connectionString: env.DATABASE_URL,
      ssl: shouldUseSsl(env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

const memoryUsers = new Map<string, UserRecord>();

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    university: String(row.university),
    faculty: String(row.faculty),
    program: String(row.program ?? "İxtisas məlumatı əlavə edilməyib"),
    year: String(row.year ?? "Kurs məlumatı əlavə edilməyib"),
    city: String(row.city ?? "Xankəndi"),
    about: String(row.about ?? "EduRate icmasına xoş gəlmisən."),
    role: row.role as UserRole,
    status: (row.status ?? "Aktiv") as UserStatus,
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)).toISOString() : null,
    termsVersion: row.terms_version ? String(row.terms_version) : null,
    privacyVersion: row.privacy_version ? String(row.privacy_version) : null,
    legalAcceptedAt: row.legal_accepted_at ? new Date(String(row.legal_accepted_at)).toISOString() : null,
    deletedAt: row.deleted_at ? new Date(String(row.deleted_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at ?? row.created_at)).toISOString(),
  };
}

export const BASE_USER_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      university VARCHAR(180) NOT NULL,
      faculty VARCHAR(180) NOT NULL,
      program VARCHAR(180) NOT NULL DEFAULT 'İxtisas məlumatı əlavə edilməyib',
      year VARCHAR(80) NOT NULL DEFAULT 'Kurs məlumatı əlavə edilməyib',
      city VARCHAR(120) NOT NULL DEFAULT 'Xankəndi',
      about VARCHAR(600) NOT NULL DEFAULT 'EduRate icmasına xoş gəlmisən.',
      role VARCHAR(20) NOT NULL DEFAULT 'student',
      status VARCHAR(32) NOT NULL DEFAULT 'Aktiv',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

    ALTER TABLE users ADD COLUMN IF NOT EXISTS program VARCHAR(180) NOT NULL DEFAULT 'İxtisas məlumatı əlavə edilməyib';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS year VARCHAR(80) NOT NULL DEFAULT 'Kurs məlumatı əlavə edilməyib';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120) NOT NULL DEFAULT 'Xankəndi';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS about VARCHAR(600) NOT NULL DEFAULT 'EduRate icmasına xoş gəlmisən.';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'Aktiv';
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'mentor', 'teacher', 'assistant_admin', 'admin', 'owner_admin'));
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('Aktiv', 'Gözləmədə', 'Məhdudlaşdırılıb'));
  `;

export async function initializeDatabase() {
  if (!databasePool) {
    console.warn("DATABASE_URL yoxdur; lokal yaddaş rejimi aktivdir.");
    return;
  }

  await databasePool.query(BASE_USER_SCHEMA_SQL);
}

export async function closeDatabase() {
  await databasePool?.end();
}

export function databaseMode() {
  return databasePool ? "postgresql" : "memory";
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!databasePool) {
    return memoryUsers.get(normalizedEmail) ?? null;
  }

  const result = await databasePool.query("SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1", [
    normalizedEmail,
  ]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (!databasePool) {
    return [...memoryUsers.values()].find((user) => user.id === id && !user.deletedAt) ?? null;
  }

  const result = await databasePool.query("SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1", [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(input: CreateUserRecord): Promise<UserRecord> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const user: UserRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    email: normalizedEmail,
    passwordHash: input.passwordHash,
    university: input.university.trim(),
    faculty: input.faculty.trim(),
    program: input.program?.trim() ?? "İxtisas məlumatı əlavə edilməyib",
    year: "Kurs məlumatı əlavə edilməyib",
    city: "Xankəndi",
    about: "EduRate icmasında universitet həyatını daha əlaqəli yaşamaq üçün buradayam.",
    // Privileged roles must only come from an already-authorized server flow.
    // An e-mail address alone is never proof of administrator ownership.
    role: input.role ?? "student",
    status: input.status ?? "Aktiv",
    emailVerifiedAt: input.emailVerifiedAt === undefined ? new Date().toISOString() : input.emailVerifiedAt,
    termsVersion: input.termsVersion ?? null,
    privacyVersion: input.privacyVersion ?? null,
    legalAcceptedAt: input.termsVersion && input.privacyVersion ? new Date().toISOString() : null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!databasePool) {
    memoryUsers.set(user.email, user);
    return user;
  }

  const result = await databasePool.query(
    `INSERT INTO users (id, name, email, password_hash, university, faculty, program, role, status, email_verified_at, terms_version, privacy_version, legal_accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.university,
      user.faculty,
      user.program,
      user.role,
      user.status,
      user.emailVerifiedAt,
      user.termsVersion,
      user.privacyVersion,
      user.legalAcceptedAt,
    ],
  );

  return mapUser(result.rows[0]);
}

export async function markEmailVerified(id:string):Promise<UserRecord|null>{
  if(!databasePool){const current=[...memoryUsers.values()].find((user)=>user.id===id);if(!current)return null;current.emailVerifiedAt=new Date().toISOString();current.updatedAt=current.emailVerifiedAt;return current;}
  const result=await databasePool.query("UPDATE users SET email_verified_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *",[id]);
  return result.rows[0]?mapUser(result.rows[0]):null;
}

export async function updatePassword(id:string,passwordHash:string):Promise<boolean>{
  if(!databasePool){const current=[...memoryUsers.values()].find((user)=>user.id===id);if(!current)return false;current.passwordHash=passwordHash;current.updatedAt=new Date().toISOString();return true;}
  const result=await databasePool.query("UPDATE users SET password_hash=$2,updated_at=NOW() WHERE id=$1",[id,passwordHash]);
  return Boolean(result.rowCount);
}

export async function listUsers(limit = 50): Promise<UserRecord[]> {
  if (!databasePool) {
    return [...memoryUsers.values()].filter((user) => !user.deletedAt).slice(0, limit);
  }

  const result = await databasePool.query("SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1", [
    limit,
  ]);
  return result.rows.map(mapUser);
}

export async function adminUpdateUser(
  id: string,
  input: Partial<Pick<UserRecord, "name" | "email" | "role" | "university" | "faculty" | "status">>,
): Promise<UserRecord | null> {
  if (!databasePool) {
    const current = [...memoryUsers.values()].find((user) => user.id === id);
    if (!current) return null;
    const previousEmail = current.email;
    const next: UserRecord = {
      ...current,
      ...input,
      name: input.name?.trim() ?? current.name,
      email: input.email?.trim().toLowerCase() ?? current.email,
      university: input.university?.trim() ?? current.university,
      faculty: input.faculty?.trim() ?? current.faculty,
      updatedAt: new Date().toISOString(),
    };
    memoryUsers.delete(previousEmail);
    memoryUsers.set(next.email, next);
    return next;
  }

  const result = await databasePool.query(
    `UPDATE users SET
       name = COALESCE($2, name), email = COALESCE($3, email),
       role = COALESCE($4, role), university = COALESCE($5, university),
       faculty = COALESCE($6, faculty), status = COALESCE($7, status), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, input.name?.trim(), input.email?.trim().toLowerCase(), input.role, input.university?.trim(), input.faculty?.trim(), input.status],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function assistantUpdateUserRole(
  id: string,
  role: Extract<UserRecord["role"], "student" | "mentor" | "teacher">,
): Promise<UserRecord | null> {
  if (!databasePool) {
    const current = [...memoryUsers.values()].find((user) => user.id === id);
    if (!current || !["student", "mentor", "teacher"].includes(current.role)) return null;
    const next = { ...current, role, updatedAt: new Date().toISOString() };
    memoryUsers.set(next.email, next);
    return next;
  }

  const result = await databasePool.query(
    `UPDATE users SET role = $2, updated_at = NOW()
     WHERE id = $1 AND role IN ('student', 'mentor', 'teacher')
     RETURNING *`,
    [id, role],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!databasePool) {
    const user = [...memoryUsers.values()].find((entry) => entry.id === id);
    if (!user || user.deletedAt) return false;
    memoryUsers.delete(user.email);
    Object.assign(user, {
      name: "Silinmiş istifadəçi",
      email: `deleted-${user.id}@deleted.invalid`,
      passwordHash: "account-deleted",
      university: "Anonimləşdirilib",
      faculty: "Anonimləşdirilib",
      program: "Anonimləşdirilib",
      year: "Anonimləşdirilib",
      city: "Anonimləşdirilib",
      about: "",
      role: "student" as UserRole,
      status: "Məhdudlaşdırılıb" as UserStatus,
      emailVerifiedAt: null,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    memoryUsers.set(user.email, user);
    return true;
  }
  const result = await databasePool.query(
    `UPDATE users SET
       name='Silinmiş istifadəçi', email='deleted-' || id::text || '@deleted.invalid',
       password_hash='account-deleted', university='Anonimləşdirilib', faculty='Anonimləşdirilib',
       program='Anonimləşdirilib', year='Anonimləşdirilib', city='Anonimləşdirilib', about='',
       role='student', status='Məhdudlaşdırılıb', email_verified_at=NULL,
       deleted_at=NOW(), anonymized_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Təsdiqlənməmiş e-poçtla açılmış hesabı yenidən qeydiyyat zamanı "təhvil almaq".
 * Ünvanın sahibi kodu daxil edib təsdiq etməyibsə, hesab onun deyil: yarımçıq qoyulmuş
 * qeydiyyat və ya başqasının e-poçtu ilə açılmış "tutma" hesabı əsl sahibi bloklamasın.
 * Şərtlər SQL-də də var — arada təsdiqlənibsə heç nə dəyişmir (`null`).
 */
export async function claimUnverifiedUser(
  id: string,
  input: { name: string; university: string; faculty: string; program: string; passwordHash: string; termsVersion: string; privacyVersion: string },
): Promise<UserRecord | null> {
  if (!databasePool) {
    const current = [...memoryUsers.values()].find((user) => user.id === id);
    if (!current || current.emailVerifiedAt || current.deletedAt || current.status !== "Aktiv") return null;
    Object.assign(current, {
      name: input.name.trim(),
      university: input.university.trim(),
      faculty: input.faculty.trim(),
      program: input.program.trim(),
      passwordHash: input.passwordHash,
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      legalAcceptedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return current;
  }
  const result = await databasePool.query(
    `UPDATE users SET name=$2, university=$3, faculty=$4, program=$5, password_hash=$6,
            terms_version=$7, privacy_version=$8, legal_accepted_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND email_verified_at IS NULL AND deleted_at IS NULL AND status='Aktiv'
     RETURNING *`,
    [id, input.name.trim(), input.university.trim(), input.faculty.trim(), input.program.trim(), input.passwordHash, input.termsVersion, input.privacyVersion],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

/** İstifadəçi hüquqi sənədlərin yeni versiyasını qəbul edir (yenidən razılıq). */
export async function recordLegalAcceptance(id: string, version: string): Promise<UserRecord | null> {
  if (!databasePool) {
    const current = [...memoryUsers.values()].find((user) => user.id === id && !user.deletedAt);
    if (!current) return null;
    Object.assign(current, { termsVersion: version, privacyVersion: version, legalAcceptedAt: new Date().toISOString() });
    return current;
  }
  const result = await databasePool.query(
    `UPDATE users SET terms_version=$2, privacy_version=$2, legal_accepted_at=NOW(), updated_at=NOW()
     WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [id, version],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function countOwnerAdmins(): Promise<number> {
  if (!databasePool) {
    return [...memoryUsers.values()].filter((user) => user.role === "owner_admin" && user.status === "Aktiv" && !user.deletedAt).length;
  }
  const result = await databasePool.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE role='owner_admin' AND status='Aktiv' AND deleted_at IS NULL",
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function updateUserProfile(
  id: string,
  input: UpdateUserRecord,
): Promise<UserRecord | null> {
  if (!databasePool) {
    const current = [...memoryUsers.values()].find((user) => user.id === id);
    if (!current) return null;
    const next = {
      ...current,
      name: input.name.trim(),
      university: input.university.trim(),
      faculty: input.faculty.trim(),
      program: input.program.trim(),
      year: input.year.trim(),
      about: input.about.trim(),
    };
    memoryUsers.set(next.email, next);
    return next;
  }

  const result = await databasePool.query(
    `UPDATE users
     SET name = $2, university = $3, faculty = $4, program = $5, year = $6,
         about = $7, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.name.trim(),
      input.university.trim(),
      input.faculty.trim(),
      input.program.trim(),
      input.year.trim(),
      input.about.trim(),
    ],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

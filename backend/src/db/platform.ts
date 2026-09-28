import { randomBytes, randomUUID } from "node:crypto";
import { ApiError } from "../lib/api-error.js";
import { databasePool, findUserById } from "./database.js";
import { env } from "../config/env.js";
import { getMedia } from "./media.js";

export type ClubStatus = "Aktiv" | "Gözləmədə" | "Məhdudlaşdırılıb";

export type ClubRecord = {
  id: string;
  slug: string;
  name: string;
  category: string;
  coordinatorInitials: string;
  shortName: string;
  tagline: string;
  description: string;
  about: string[];
  tone: "lime" | "violet" | "cyan" | "coral" | "amber" | "mint";
  visualMark: string;
  meeting: { cadence: string; day: string; time: string; place: string };
  focusTags: string[];
  events: Array<{ id: string; title: string; summary: string; date: string; dateLabel: string; timeLabel: string; place: string; format: string }>;
  members: Array<{ id: string; initials: string; role: string; focus: string }>;
  history: Array<{ id?: string; year: string; title: string; description: string }>;
  memberCount: number;
  eventCount: number;
  createdBy: string | null;
  status: ClubStatus;
  createdAt: string;
  updatedAt: string;
  coverUrl?: string;
};

export type ClubInput = Pick<ClubRecord, "slug" | "name" | "category" | "coordinatorInitials"> & Partial<Pick<ClubRecord,"shortName"|"tagline"|"description"|"about"|"tone"|"visualMark"|"meeting"|"focusTags">> & {
  status?: ClubStatus;
};

export type ClubMemberRecord = {
  id: string;
  name: string;
  role: "leader" | "member";
  isCreator: boolean;
  avatarUrl?: string;
};

export type TeacherReviewRecord = {
  id: string;
  userId: string;
  teacherId: string;
  course: string;
  semester: string;
  text: string;
  criteria: {
    clarity: number;
    subjectKnowledge: number;
    objectivity: number;
    communication: number;
  };
  rating: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type TeacherReviewStatus = TeacherReviewRecord["status"];

export type SupportTicketRecord = {
  id: string;
  reference: string;
  userId: string | null;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
};

const rawClubSeeds: Array<Pick<ClubRecord,"slug"|"name"|"category"|"coordinatorInitials"|"memberCount"|"eventCount"|"status">> = [
  { slug: "innovasiya-robototexnika", name: "İnnovasiya və Robototexnika Klubu", category: "Texnologiya", coordinatorInitials: "NH", memberCount: 186, eventCount: 8, status: "Aktiv" },
  { slug: "debat-natiqlik", name: "Debat və Natiqlik Cəmiyyəti", category: "Akademik", coordinatorInitials: "NA", memberCount: 142, eventCount: 6, status: "Aktiv" },
  { slug: "yasil-kampus", name: "Yaşıl Kampus Birliyi", category: "Sosial təsir", coordinatorInitials: "LM", memberCount: 118, eventCount: 5, status: "Aktiv" },
  { slug: "vizual-hekaye", name: "Vizual Hekayə Klubu", category: "Yaradıcılıq", coordinatorInitials: "NG", memberCount: 96, eventCount: 7, status: "Aktiv" },
  { slug: "konulluler-sebekesi", name: "Könüllülər Şəbəkəsi", category: "Sosial təsir", coordinatorInitials: "RA", memberCount: 214, eventCount: 11, status: "Aktiv" },
  { slug: "sehne-musiqi", name: "Səhnə və Musiqi Birliyi", category: "Mədəniyyət", coordinatorInitials: "SD", memberCount: 124, eventCount: 9, status: "Aktiv" },
];

const clubSeeds: Omit<ClubRecord, "id" | "createdAt" | "updatedAt">[] = rawClubSeeds.map((club,index)=>({
  ...club,
  shortName:club.name.replace(/ (Klubu|Birliyi|Cəmiyyəti|Təşkilatı)$/u,""),
  tagline:["Fikri birlikdə sına, nəticəni kampusla paylaş.","Aydın düşün, diqqətlə dinlə və əsaslı danış.","Kiçik addımlarla ölçülə bilən dəyişiklik yarat.","Kampusu yeni baxışla gör və hekayəni paylaş.","Vaxtını mənalı təşəbbüslərə çevir.","Səhnədə özünü ifadə et və birlikdə yarat."][index]!,
  description:`${club.category} istiqamətində tələbələri bir araya gətirən açıq universitet klubudur.`,
  about:[`${club.name} tələbələrin bilik, təcrübə və ideyalarını təhlükəsiz, əməkdaşlığa açıq mühitdə inkişaf etdirməsi üçün fəaliyyət göstərir.`],
  tone:(['lime','violet','mint','coral','amber','cyan'] as const)[index]!,
  visualMark:`K${String(index+1).padStart(2,"0")}`,
  meeting:{cadence:"Həftəlik",day:"Cədvəl üzrə",time:"18:00",place:"Universitet kampusu"},
  focusTags:[club.category,"Komanda işi","Tələbə təşəbbüsü"],
  createdBy:null,
  events:[],
  members:[{id:`${club.slug}-coordinator`,initials:club.coordinatorInitials,role:"Klub koordinatoru",focus:"Proqram və üzvlər"}],
  history:[],
}));

const now = () => new Date().toISOString();
const memoryClubs = new Map<string, ClubRecord>(
  clubSeeds.map((club) => {
    const createdAt = "2026-08-01T00:00:00.000Z";
    return [club.slug, { ...club, id: randomUUID(), createdBy: null, createdAt, updatedAt: createdAt }];
  }),
);
const memoryMemberships = new Set<string>();
const memoryClubLeaders = new Set<string>();
const memoryReviews = new Map<string, TeacherReviewRecord>();
// Bazada rəy həm `teacher_id` (slug), həm `teacher_profile_id` (uuid) ilə tapılır;
// yaddaş rejimi yalnız slug-ı yoxlayırdı və lokal testdə müəllim öz rəylərini görmürdü.
const memoryReviewProfiles = new Map<string, string>();
const memoryTickets = new Map<string, SupportTicketRecord>();

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function mapClub(row: Record<string, unknown>): ClubRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category),
    coordinatorInitials: String(row.coordinator_initials),
    shortName:String(row.short_name ?? row.name),
    tagline:String(row.tagline ?? ""),
    description:String(row.description ?? ""),
    about:Array.isArray(row.about) ? row.about.map(String) : [],
    tone:(row.tone ?? "lime") as ClubRecord["tone"],
    visualMark:String(row.visual_mark ?? row.coordinator_initials),
    meeting:typeof row.meeting === "object" && row.meeting ? row.meeting as ClubRecord["meeting"] : {cadence:"Yenilənir",day:"—",time:"—",place:"Kampus"},
    focusTags:Array.isArray(row.focus_tags) ? row.focus_tags.map(String) : [],
    events:Array.isArray(row.events) ? row.events as ClubRecord["events"] : [],
    members:Array.isArray(row.members) ? row.members as ClubRecord["members"] : [],
    history:Array.isArray(row.history) ? row.history as ClubRecord["history"] : [],
    memberCount: Number(row.member_count),
    eventCount: Array.isArray(row.events) ? row.events.length : 0,
    createdBy: row.created_by ? String(row.created_by) : null,
    status: row.status as ClubStatus,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    coverUrl: row.cover_url ? String(row.cover_url) : undefined,
  };
}

function mapReview(row: Record<string, unknown>): TeacherReviewRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    teacherId: String(row.teacher_id),
    course: String(row.course),
    semester: String(row.semester),
    text: String(row.review_text),
    criteria: {
      clarity: Number(row.clarity),
      subjectKnowledge: Number(row.subject_knowledge),
      objectivity: Number(row.objectivity),
      communication: Number(row.communication),
    },
    rating: Number(row.rating),
    status: row.status as TeacherReviewRecord["status"],
    createdAt: iso(row.created_at),
  };
}

export const BASE_PLATFORM_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS clubs (
      id UUID PRIMARY KEY,
      slug VARCHAR(90) NOT NULL UNIQUE,
      name VARCHAR(140) NOT NULL,
      category VARCHAR(80) NOT NULL,
      coordinator_initials VARCHAR(6) NOT NULL,
      short_name VARCHAR(100) NOT NULL DEFAULT '',
      tagline VARCHAR(220) NOT NULL DEFAULT '',
      description VARCHAR(800) NOT NULL DEFAULT '',
      about JSONB NOT NULL DEFAULT '[]'::jsonb,
      tone VARCHAR(16) NOT NULL DEFAULT 'lime',
      visual_mark VARCHAR(12) NOT NULL DEFAULT '',
      meeting JSONB NOT NULL DEFAULT '{}'::jsonb,
      focus_tags TEXT[] NOT NULL DEFAULT '{}',
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      members JSONB NOT NULL DEFAULT '[]'::jsonb,
      history JSONB NOT NULL DEFAULT '[]'::jsonb,
      member_count INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
      event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
      status VARCHAR(32) NOT NULL DEFAULT 'Aktiv' CHECK (status IN ('Aktiv', 'Gözləmədə', 'Məhdudlaşdırılıb')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS club_memberships (
      club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (club_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS teacher_reviews (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teacher_id VARCHAR(120) NOT NULL,
      course VARCHAR(180) NOT NULL,
      semester VARCHAR(80) NOT NULL,
      review_text VARCHAR(1200) NOT NULL,
      clarity SMALLINT NOT NULL CHECK (clarity BETWEEN 1 AND 5),
      subject_knowledge SMALLINT NOT NULL CHECK (subject_knowledge BETWEEN 1 AND 5),
      objectivity SMALLINT NOT NULL CHECK (objectivity BETWEEN 1 AND 5),
      communication SMALLINT NOT NULL CHECK (communication BETWEEN 1 AND 5),
      rating NUMERIC(3,2) NOT NULL CHECK (rating BETWEEN 1 AND 5),
      status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, teacher_id, semester)
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY,
      reference VARCHAR(32) NOT NULL UNIQUE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      topic VARCHAR(120) NOT NULL,
      message VARCHAR(2000) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS short_name VARCHAR(100) NOT NULL DEFAULT '';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tagline VARCHAR(220) NOT NULL DEFAULT '';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS description VARCHAR(800) NOT NULL DEFAULT '';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS about JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tone VARCHAR(16) NOT NULL DEFAULT 'lime';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS visual_mark VARCHAR(12) NOT NULL DEFAULT '';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS meeting JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS focus_tags TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS events JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'member';
  `;

export async function initializePlatformDatabase() {
  if (!databasePool) return;

  await databasePool.query(BASE_PLATFORM_SCHEMA_SQL);

  if (env.SEED_DEMO_DATA) for (const club of clubSeeds) {
    await databasePool.query(
      `INSERT INTO clubs (id, slug, name, category, coordinator_initials, member_count, event_count, status,
         short_name,tagline,description,about,tone,visual_mark,meeting,focus_tags,events,members,history)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (slug) DO UPDATE SET
         short_name=CASE WHEN clubs.short_name='' THEN EXCLUDED.short_name ELSE clubs.short_name END,
         tagline=CASE WHEN clubs.tagline='' THEN EXCLUDED.tagline ELSE clubs.tagline END,
         description=CASE WHEN clubs.description='' THEN EXCLUDED.description ELSE clubs.description END,
         about=CASE WHEN clubs.about='[]'::jsonb THEN EXCLUDED.about ELSE clubs.about END,
         visual_mark=CASE WHEN clubs.visual_mark='' THEN EXCLUDED.visual_mark ELSE clubs.visual_mark END,
         meeting=CASE WHEN clubs.meeting='{}'::jsonb THEN EXCLUDED.meeting ELSE clubs.meeting END,
         focus_tags=CASE WHEN cardinality(clubs.focus_tags)=0 THEN EXCLUDED.focus_tags ELSE clubs.focus_tags END,
         members=CASE WHEN clubs.members='[]'::jsonb THEN EXCLUDED.members ELSE clubs.members END`,
      [randomUUID(),club.slug,club.name,club.category,club.coordinatorInitials,club.memberCount,club.eventCount,club.status,
        club.shortName,club.tagline,club.description,JSON.stringify(club.about),club.tone,club.visualMark,JSON.stringify(club.meeting),club.focusTags,JSON.stringify(club.events),JSON.stringify(club.members),JSON.stringify(club.history)],
    );
  }
}

export async function listClubs(): Promise<ClubRecord[]> {
  if (!databasePool) return Promise.all([...memoryClubs.values()].map(async(club)=>({
    ...club,
    memberCount:[...memoryMemberships].filter((key)=>key.endsWith(`:${club.slug}`)).length,
    eventCount:club.events.length,
    coverUrl:(await getMedia("club",club.id))?.secureUrl,
  }))).then((items)=>items.sort((a, b) => a.name.localeCompare(b.name, "az")));
  const result = await databasePool.query(`SELECT clubs.*, media_assets.secure_url AS cover_url,
    (SELECT COUNT(*)::int FROM club_memberships WHERE club_id=clubs.id) AS member_count
    FROM clubs LEFT JOIN media_assets ON media_assets.owner_type='club' AND media_assets.owner_id=clubs.id::text ORDER BY name ASC`);
  return result.rows.map(mapClub);
}

export async function findClub(idOrSlug: string): Promise<ClubRecord | null> {
  if (!databasePool) {
    const club=[...memoryClubs.values()].find((item) => item.id === idOrSlug || item.slug === idOrSlug);
    return club ? {...club,memberCount:[...memoryMemberships].filter((key)=>key.endsWith(`:${club.slug}`)).length,eventCount:club.events.length,coverUrl:(await getMedia("club",club.id))?.secureUrl} : null;
  }
  const result = await databasePool.query(`SELECT clubs.*, media_assets.secure_url AS cover_url,
    (SELECT COUNT(*)::int FROM club_memberships WHERE club_id=clubs.id) AS member_count
    FROM clubs LEFT JOIN media_assets ON media_assets.owner_type='club' AND media_assets.owner_id=clubs.id::text WHERE clubs.id::text = $1 OR clubs.slug = $1 LIMIT 1`, [idOrSlug]);
  return result.rows[0] ? mapClub(result.rows[0]) : null;
}

export async function createClub(input: ClubInput, createdBy: string | null = null): Promise<ClubRecord> {
  const club: ClubRecord = { id: randomUUID(), ...input,
    shortName:input.shortName??input.name,tagline:input.tagline??"Birlikdə öyrən, yarat və kampusla paylaş.",
    description:input.description??`${input.category} istiqamətində tələbələri bir araya gətirən açıq universitet klubudur.`,
    about:input.about??[`${input.name} tələbələrin ortaq maraq və təşəbbüslərini inkişaf etdirməsi üçün fəaliyyət göstərir.`],
    tone:input.tone??"lime",visualMark:input.visualMark??input.coordinatorInitials,
    meeting:input.meeting??{cadence:"Yenilənir",day:"Cədvəl üzrə",time:"18:00",place:"Universitet kampusu"},
    focusTags:input.focusTags??[input.category],memberCount: 0, eventCount: 0,
    events:[],members:[{id:`${input.slug}-coordinator`,initials:input.coordinatorInitials,role:"Klub koordinatoru",focus:"Proqram və üzvlər"}],history:[],
    status: input.status ?? "Gözləmədə", createdBy, createdAt: now(), updatedAt: now() };
  if (!databasePool) {
    if (memoryClubs.has(club.slug)) throw new ApiError(409, "CLUB_EXISTS", "Bu qısa adla klub artıq mövcuddur.");
    memoryClubs.set(club.slug, club);
    if (createdBy) {
      memoryMemberships.add(`${createdBy}:${club.slug}`);
      memoryClubLeaders.add(`${createdBy}:${club.slug}`);
      club.memberCount = 1;
    }
    return club;
  }
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO clubs (id,slug,name,category,coordinator_initials,status,short_name,tagline,description,about,tone,visual_mark,meeting,focus_tags,members,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [club.id,club.slug,club.name,club.category,club.coordinatorInitials,club.status,club.shortName,club.tagline,club.description,
        JSON.stringify(club.about),club.tone,club.visualMark,JSON.stringify(club.meeting),club.focusTags,JSON.stringify(club.members),createdBy],
    );
    if (createdBy) {
      await client.query("INSERT INTO club_memberships(club_id,user_id,role) VALUES($1,$2,'leader') ON CONFLICT(club_id,user_id) DO UPDATE SET role='leader'", [club.id, createdBy]);
      result.rows[0].member_count = 1;
    }
    await client.query("COMMIT");
    return mapClub(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateClub(id: string, input: Partial<ClubInput>): Promise<ClubRecord | null> {
  if (!databasePool) {
    const current = await findClub(id);
    if (!current) return null;
    const next = { ...current, ...input, updatedAt: now() };
    memoryClubs.delete(current.slug);
    memoryClubs.set(next.slug, next);
    return next;
  }
  const result = await databasePool.query(
    `UPDATE clubs SET slug = COALESCE($2, slug), name = COALESCE($3, name),
       category = COALESCE($4, category), coordinator_initials = COALESCE($5, coordinator_initials),
       status = COALESCE($6, status), short_name=COALESCE($7,short_name),tagline=COALESCE($8,tagline),
       description=COALESCE($9,description),about=COALESCE($10,about),tone=COALESCE($11,tone),
       visual_mark=COALESCE($12,visual_mark),meeting=COALESCE($13,meeting),focus_tags=COALESCE($14,focus_tags),updated_at = NOW()
     WHERE id::text = $1 OR slug = $1 RETURNING *`,
    [id,input.slug,input.name,input.category,input.coordinatorInitials,input.status,input.shortName,input.tagline,input.description,
      input.about ? JSON.stringify(input.about) : undefined,input.tone,input.visualMark,input.meeting ? JSON.stringify(input.meeting) : undefined,input.focusTags],
  );
  return result.rows[0] ? mapClub(result.rows[0]) : null;
}

export async function deleteClub(id: string): Promise<boolean> {
  if (!databasePool) {
    const club = await findClub(id);
    if (!club) return false;
    for (const key of [...memoryMemberships]) if (key.endsWith(`:${club.slug}`)) memoryMemberships.delete(key);
    for (const key of [...memoryClubLeaders]) if (key.endsWith(`:${club.slug}`)) memoryClubLeaders.delete(key);
    return memoryClubs.delete(club.slug);
  }
  const result = await databasePool.query("DELETE FROM clubs WHERE id::text = $1 OR slug = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function isClubLeader(clubId: string, userId: string): Promise<boolean> {
  const club = await findClub(clubId);
  if (!club) return false;
  if (club.createdBy === userId) return true;
  if (!databasePool) return memoryClubLeaders.has(`${userId}:${club.slug}`);
  const result = await databasePool.query("SELECT 1 FROM club_memberships WHERE club_id=$1 AND user_id=$2 AND role='leader'", [club.id, userId]);
  return Boolean(result.rowCount);
}

export async function listClubMembers(clubId: string): Promise<ClubMemberRecord[]> {
  const club = await findClub(clubId);
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  if (!databasePool) {
    const users = await Promise.all([...memoryMemberships].filter((key) => key.endsWith(`:${club.slug}`)).map((key) => findUserById(key.slice(0, key.indexOf(":")))));
    return users.filter(Boolean).map((user) => ({ id:user!.id,name:user!.name,role:memoryClubLeaders.has(`${user!.id}:${club.slug}`)||club.createdBy===user!.id?"leader":"member",isCreator:club.createdBy===user!.id }));
  }
  const result = await databasePool.query(`SELECT users.id,users.name,club_memberships.role,clubs.created_by,media_assets.secure_url avatar_url
    FROM club_memberships JOIN clubs ON clubs.id=club_memberships.club_id JOIN users ON users.id=club_memberships.user_id
    LEFT JOIN media_assets ON media_assets.owner_type='avatar' AND media_assets.owner_id=users.id::text
    WHERE club_memberships.club_id=$1 ORDER BY (club_memberships.role='leader') DESC,club_memberships.created_at ASC`, [club.id]);
  return result.rows.map((row) => ({ id:String(row.id),name:String(row.name),role:row.role as "leader"|"member",isCreator:String(row.created_by)===String(row.id),avatarUrl:row.avatar_url?String(row.avatar_url):undefined }));
}

export async function setClubLeader(clubId: string, userId: string, leader: boolean): Promise<ClubMemberRecord> {
  const club = await findClub(clubId);
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  if (!leader && club.createdBy === userId) throw new ApiError(409, "CREATOR_LEADER_REQUIRED", "Klubu yaradan şəxs lider olaraq qalmalıdır.");
  if (!databasePool) {
    const key=`${userId}:${club.slug}`;
    if (!memoryMemberships.has(key)) throw new ApiError(404,"CLUB_MEMBER_NOT_FOUND","İstifadəçi klubun üzvü deyil.");
    if (leader) memoryClubLeaders.add(key); else memoryClubLeaders.delete(key);
    const user=await findUserById(userId);if(!user)throw new ApiError(404,"USER_NOT_FOUND","İstifadəçi tapılmadı.");
    return {id:user.id,name:user.name,role:leader?"leader":"member",isCreator:club.createdBy===user.id};
  }
  const result=await databasePool.query(`UPDATE club_memberships SET role=$3 WHERE club_id=$1 AND user_id=$2 RETURNING user_id`,[club.id,userId,leader?"leader":"member"]);
  if(!result.rowCount)throw new ApiError(404,"CLUB_MEMBER_NOT_FOUND","İstifadəçi klubun üzvü deyil.");
  await databasePool.query(`UPDATE conversation_participants SET role=$3 FROM conversations
    WHERE conversation_participants.conversation_id=conversations.id AND conversations.club_id=$1 AND conversation_participants.user_id=$2`,[club.id,userId,leader?"admin":"member"]);
  const user=await findUserById(userId);if(!user)throw new ApiError(404,"USER_NOT_FOUND","İstifadəçi tapılmadı.");
  return {id:user.id,name:user.name,role:leader?"leader":"member",isCreator:club.createdBy===user.id,avatarUrl:(await getMedia("avatar",user.id))?.secureUrl};
}

/**
 * Klub liderinin idarə etdiyi siyahılar (klubun öz tədbirləri və tarixçəsi).
 * Əvvəl bu sahələrə yazan heç bir yol yox idi: "Tədbirlər" və "Tarixçə" tabları
 * hər klubda həmişə boş qalırdı. Qeydlər atomik əlavə/silinir — iki lider eyni
 * anda yazanda biri o birinin dəyişikliyini əzmir.
 */
export type ClubListName = "events" | "history";
const CLUB_LIST_LIMITS: Record<ClubListName, number> = { events: 40, history: 30 };

export async function appendClubEntry(clubId: string, list: ClubListName, entry: { id: string } & Record<string, unknown>): Promise<ClubRecord> {
  const club = await findClub(clubId);
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  const limitReached = () => new ApiError(409, "CLUB_LIST_FULL", list === "events" ? "Klubda ən çox 40 tədbir saxlanıla bilər. Köhnələri sil." : "Tarixçədə ən çox 30 qeyd saxlanıla bilər.");
  if (!databasePool) {
    const stored = memoryClubs.get(club.slug);
    if (!stored) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
    const current = stored[list] as unknown[];
    if (current.length >= CLUB_LIST_LIMITS[list]) throw limitReached();
    memoryClubs.set(club.slug, { ...stored, [list]: [...current, entry], updatedAt: now() });
  } else {
    // Sütun adı yalnız sabit siyahıdan gəlir (istifadəçi mətni deyil).
    const column = list === "events" ? "events" : "history";
    const result = await databasePool.query(
      `UPDATE clubs SET ${column} = ${column} || jsonb_build_array($2::jsonb), updated_at = NOW()
       WHERE id = $1 AND jsonb_array_length(${column}) < $3 RETURNING id`,
      [club.id, JSON.stringify(entry), CLUB_LIST_LIMITS[list]],
    );
    if (!result.rowCount) throw limitReached();
  }
  return (await findClub(club.id))!;
}

export async function removeClubEntry(clubId: string, list: ClubListName, entryId: string): Promise<ClubRecord> {
  const club = await findClub(clubId);
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  const missing = () => new ApiError(404, "CLUB_ENTRY_NOT_FOUND", "Qeyd tapılmadı.");
  if (!databasePool) {
    const stored = memoryClubs.get(club.slug);
    const current = (stored?.[list] ?? []) as Array<{ id?: string }>;
    if (!stored || !current.some((item) => item.id === entryId)) throw missing();
    memoryClubs.set(club.slug, { ...stored, [list]: current.filter((item) => item.id !== entryId), updatedAt: now() });
  } else {
    const column = list === "events" ? "events" : "history";
    const result = await databasePool.query(
      `UPDATE clubs SET ${column} = COALESCE(
         (SELECT jsonb_agg(item ORDER BY position) FROM jsonb_array_elements(${column}) WITH ORDINALITY AS entries(item, position)
          WHERE item->>'id' IS DISTINCT FROM $2), '[]'::jsonb), updated_at = NOW()
       WHERE id = $1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(${column}) AS existing(item) WHERE existing.item->>'id' = $2)
       RETURNING id`,
      [club.id, entryId],
    );
    if (!result.rowCount) throw missing();
  }
  return (await findClub(club.id))!;
}

export async function listMyClubMemberships(userId: string): Promise<ClubRecord[]> {
  if (!databasePool) {
    const slugs = new Set([...memoryMemberships].filter((key) => key.startsWith(`${userId}:`)).map((key) => key.slice(userId.length + 1)));
    return [...memoryClubs.values()].filter((club) => slugs.has(club.slug));
  }
  const result = await databasePool.query(
    `SELECT clubs.*, media_assets.secure_url AS cover_url,
       (SELECT COUNT(*)::int FROM club_memberships all_members WHERE all_members.club_id=clubs.id) AS member_count
     FROM club_memberships JOIN clubs ON clubs.id = club_memberships.club_id
     LEFT JOIN media_assets ON media_assets.owner_type='club' AND media_assets.owner_id=clubs.id::text
     WHERE club_memberships.user_id = $1 ORDER BY club_memberships.created_at DESC`,
    [userId],
  );
  return result.rows.map(mapClub);
}

export async function joinClub(id: string, userId: string): Promise<ClubRecord> {
  const club = await findClub(id);
  if (!club || club.status !== "Aktiv") throw new ApiError(404, "CLUB_NOT_FOUND", "Aktiv klub tapılmadı.");
  if (!databasePool) {
    const key = `${userId}:${club.slug}`;
    if (memoryMemberships.has(key)) throw new ApiError(409, "ALREADY_MEMBER", "Artıq bu klubun üzvüsən.");
    memoryMemberships.add(key);
    club.memberCount += 1;
    club.updatedAt = now();
    return club;
  }
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO club_memberships (club_id, user_id) VALUES ($1, $2)", [club.id, userId]);
    const result = await client.query(`UPDATE clubs SET
      member_count = (SELECT COUNT(*)::int FROM club_memberships WHERE club_id=$1),
      updated_at = NOW() WHERE id = $1 RETURNING *`, [club.id]);
    await client.query("COMMIT");
    return mapClub(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new ApiError(409, "ALREADY_MEMBER", "Artıq bu klubun üzvüsən.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function leaveClub(id: string, userId: string): Promise<ClubRecord> {
  const club = await findClub(id);
  if (!club) throw new ApiError(404, "CLUB_NOT_FOUND", "Klub tapılmadı.");
  if (!databasePool) {
    if (club.createdBy === userId || memoryClubLeaders.has(`${userId}:${club.slug}`)) throw new ApiError(409,"CLUB_LEADER_CANNOT_LEAVE","Klubdan çıxmaq üçün əvvəlcə liderlik səlahiyyətini ötür.");
    const deleted = memoryMemberships.delete(`${userId}:${club.slug}`);
    if (!deleted) throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "Klub üzvlüyü tapılmadı.");
    club.memberCount = Math.max(0, club.memberCount - 1);
    club.updatedAt = now();
    return club;
  }
  const client = await databasePool.connect();
  try {
    await client.query("BEGIN");
    const membership=await client.query("SELECT role FROM club_memberships WHERE club_id=$1 AND user_id=$2",[club.id,userId]);
    if(membership.rows[0]?.role==="leader")throw new ApiError(409,"CLUB_LEADER_CANNOT_LEAVE","Klubdan çıxmaq üçün əvvəlcə liderlik səlahiyyətini ötür.");
    const deleted = await client.query("DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2", [club.id, userId]);
    if (!deleted.rowCount) throw new ApiError(404, "MEMBERSHIP_NOT_FOUND", "Klub üzvlüyü tapılmadı.");
    const result = await client.query(`UPDATE clubs SET
      member_count = (SELECT COUNT(*)::int FROM club_memberships WHERE club_id=$1),
      updated_at = NOW() WHERE id = $1 RETURNING *`, [club.id]);
    await client.query("COMMIT");
    return mapClub(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createTeacherReview(
  userId: string,
  input: Omit<TeacherReviewRecord, "id" | "userId" | "rating" | "status" | "createdAt">,
  teacherProfileId?: string,
): Promise<TeacherReviewRecord> {
  const rating = Object.values(input.criteria).reduce((total, value) => total + value, 0) / 4;
  const review: TeacherReviewRecord = { id: randomUUID(), userId, ...input, rating, status: "pending", createdAt: now() };
  const uniqueKey = `${userId}:${input.teacherId}:${input.semester}`;
  if (!databasePool) {
    if (memoryReviews.has(uniqueKey)) throw new ApiError(409, "REVIEW_EXISTS", "Bu müəllim üçün cari semestrdə artıq rəy göndərmisən.");
    memoryReviews.set(uniqueKey, review);
    if (teacherProfileId) memoryReviewProfiles.set(review.id, teacherProfileId);
    return review;
  }
  try {
    const result = await databasePool.query(
      `INSERT INTO teacher_reviews
         (id, user_id, teacher_id, teacher_profile_id, course, semester, review_text, clarity, subject_knowledge, objectivity, communication, rating)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [review.id, userId, input.teacherId, teacherProfileId ?? null, input.course, input.semester, input.text, input.criteria.clarity, input.criteria.subjectKnowledge, input.criteria.objectivity, input.criteria.communication, rating],
    );
    return mapReview(result.rows[0]);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      throw new ApiError(409, "REVIEW_EXISTS", "Bu müəllim üçün cari semestrdə artıq rəy göndərmisən.");
    }
    throw error;
  }
}

export async function listTeacherReviews(filters: {
  teacherId?: string;
  userId?: string;
  semester?: string;
  status?: TeacherReviewStatus;
  limit?: number;
} = {}): Promise<TeacherReviewRecord[]> {
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  if (!databasePool) {
    return [...memoryReviews.values()]
      .filter((review) => !filters.teacherId || review.teacherId === filters.teacherId || memoryReviewProfiles.get(review.id) === filters.teacherId)
      .filter((review) => !filters.userId || review.userId === filters.userId)
      .filter((review) => !filters.semester || review.semester === filters.semester)
      .filter((review) => !filters.status || review.status === filters.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters.teacherId) {
    values.push(filters.teacherId);
    clauses.push(`(teacher_id = $${values.length} OR teacher_profile_id::text = $${values.length})`);
  }
  if (filters.userId) {
    values.push(filters.userId);
    clauses.push(`user_id = $${values.length}`);
  }
  if (filters.semester) {
    values.push(filters.semester);
    clauses.push(`semester = $${values.length}`);
  }
  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }
  values.push(limit);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await databasePool.query(
    `SELECT * FROM teacher_reviews ${where} ORDER BY created_at DESC LIMIT $${values.length}`,
    values,
  );
  return result.rows.map(mapReview);
}

export async function updateTeacherReviewStatus(
  id: string,
  status: TeacherReviewStatus,
): Promise<TeacherReviewRecord | null> {
  if (!databasePool) {
    const entry = [...memoryReviews.entries()].find(([, review]) => review.id === id);
    if (!entry) return null;
    const [key, review] = entry;
    const updated = { ...review, status };
    memoryReviews.set(key, updated);
    return updated;
  }

  const result = await databasePool.query(
    "UPDATE teacher_reviews SET status = $2 WHERE id = $1 RETURNING *",
    [id, status],
  );
  return result.rows[0] ? mapReview(result.rows[0]) : null;
}

export async function createSupportTicket(
  input: Pick<SupportTicketRecord, "name" | "email" | "topic" | "message">,
  userId: string | null,
): Promise<SupportTicketRecord> {
  const ticket: SupportTicketRecord = {
    id: randomUUID(), reference: `EDU-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    userId, ...input, status: "open", createdAt: now(),
  };
  if (!databasePool) {
    memoryTickets.set(ticket.id, ticket);
    return ticket;
  }
  const result = await databasePool.query(
    `INSERT INTO support_tickets (id, reference, user_id, name, email, topic, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [ticket.id, ticket.reference, userId, input.name, input.email, input.topic, input.message],
  );
  return { ...ticket, createdAt: iso(result.rows[0].created_at) };
}

function mapTicket(row: Record<string, unknown>): SupportTicketRecord {
  return { id:String(row.id), reference:String(row.reference), userId:row.user_id ? String(row.user_id) : null,
    name:String(row.name), email:String(row.email), topic:String(row.topic), message:String(row.message),
    status:row.status as SupportTicketRecord["status"], createdAt:iso(row.created_at) };
}

export async function listSupportTickets(userId?: string): Promise<SupportTicketRecord[]> {
  if (!databasePool) return [...memoryTickets.values()].filter((ticket)=>!userId||ticket.userId===userId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const result=await databasePool.query(`SELECT * FROM support_tickets ${userId?"WHERE user_id=$1":""} ORDER BY created_at DESC`,userId?[userId]:[]);
  return result.rows.map(mapTicket);
}

export async function updateSupportTicketStatus(id:string,status:SupportTicketRecord["status"]):Promise<SupportTicketRecord|null> {
  if (!databasePool) { const ticket=memoryTickets.get(id); if(!ticket)return null; const next={...ticket,status}; memoryTickets.set(id,next); return next; }
  const result=await databasePool.query("UPDATE support_tickets SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *",[id,status]);
  return result.rows[0]?mapTicket(result.rows[0]):null;
}

export async function getPlatformCounts() {
  if (!databasePool) {
    return { clubs: memoryClubs.size, memberships: memoryMemberships.size, reviews: memoryReviews.size, tickets: memoryTickets.size };
  }
  const result = await databasePool.query(`SELECT
    (SELECT COUNT(*)::int FROM clubs) AS clubs,
    (SELECT COUNT(*)::int FROM club_memberships) AS memberships,
    (SELECT COUNT(*)::int FROM teacher_reviews) AS reviews,
    (SELECT COUNT(*)::int FROM support_tickets) AS tickets`);
  return result.rows[0] as { clubs: number; memberships: number; reviews: number; tickets: number };
}

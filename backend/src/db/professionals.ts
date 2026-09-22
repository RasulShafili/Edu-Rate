import { randomUUID } from "node:crypto";
import { databasePool } from "./database.js";
import { env } from "../config/env.js";

export type ProfessionalKind = "teacher" | "mentor";
export type ProfessionalProfile = {
  id: string; userId: string | null; kind: ProfessionalKind; slug: string; name: string;
  headline: string; specialty: string; biography: string; city: string; experienceYears: number;
  availability: string; meetingMode: string; languages: string[]; expertise: string[];
  rating: number; reviewCount: number;
  criteria: { clarity: number; subjectKnowledge: number; objectivity: number; communication: number };
  status: "pending" | "approved" | "rejected"; visible: boolean;
};

type ProfessionalUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  program: string;
  city: string;
  about?: string;
};

const seedProfiles: Omit<ProfessionalProfile, "id" | "userId" | "rating" | "reviewCount" | "criteria">[] = [
  { kind:"teacher", slug:"leyla-memmedova", name:"Leyla Məmmədova", headline:"Riyaziyyat müəllimi", specialty:"Riyaziyyat", biography:"Mürəkkəb mövzuları gündəlik nümunələrlə sadələşdirir.", city:"Bakı", experienceYears:11, availability:"Bu gün · 18:30-dan sonra", meetingMode:"Hibrid", languages:["Azərbaycan dili"], expertise:["Cəbr","Analiz"], status:"approved", visible:true },
  { kind:"teacher", slug:"nigar-huseynli", name:"Nigar Hüseynli", headline:"İngilis dili müəllimi", specialty:"İngilis dili", biography:"Danışıq və akademik yazı bacarıqlarını praktik yanaşma ilə inkişaf etdirir.", city:"Xankəndi", experienceYears:8, availability:"Həftəiçi", meetingMode:"Onlayn", languages:["Azərbaycan dili","İngilis dili"], expertise:["Speaking","Writing"], status:"approved", visible:true },
  { kind:"teacher", slug:"tural-kerimov", name:"Tural Kərimov", headline:"Fizika müəllimi", specialty:"Fizika", biography:"Fiziki qanunları təcrübə və vizual nümunələrlə izah edir.", city:"Bakı", experienceYears:10, availability:"Çərşənbə axşamı", meetingMode:"Əyani", languages:["Azərbaycan dili"], expertise:["Mexanika","Elektrik"], status:"approved", visible:true },
  { kind:"teacher", slug:"murad-eliyev", name:"Murad Əliyev", headline:"Proqramlaşdırma müəllimi", specialty:"Proqramlaşdırma", biography:"Alqoritmləri praktik layihələr üzərindən öyrədir.", city:"Xankəndi", experienceYears:9, availability:"Həftəiçi", meetingMode:"Hibrid", languages:["Azərbaycan dili"], expertise:["Alqoritmlər","Backend"], status:"approved", visible:true },
  { kind:"teacher", slug:"aysel-rehimova", name:"Aysel Rəhimova", headline:"Tarix müəllimi", specialty:"Tarix", biography:"Tarixi hadisələri mənbə və səbəb-nəticə əlaqələri ilə izah edir.", city:"Şuşa", experienceYears:12, availability:"Cümə", meetingMode:"Əyani", languages:["Azərbaycan dili"], expertise:["Azərbaycan tarixi"], status:"approved", visible:true },
  { kind:"teacher", slug:"emin-seferli", name:"Emin Səfərli", headline:"İqtisadiyyat müəllimi", specialty:"İqtisadiyyat", biography:"İqtisadi anlayışları real bazar nümunələri ilə əlaqələndirir.", city:"Bakı", experienceYears:8, availability:"Şənbə", meetingMode:"Onlayn", languages:["Azərbaycan dili","İngilis dili"], expertise:["Mikroiqtisadiyyat"], status:"approved", visible:true },
  { kind:"mentor", slug:"aygun-rzayeva", name:"Aygün Rzayeva", headline:"Məhsul strategiyası mentoru", specialty:"Məhsul strategiyası", biography:"İdeyanı aydın məhsul hekayəsinə və yol xəritəsinə çevirir.", city:"Bakı", experienceYears:9, availability:"4 saat ərzində cavab verir", meetingMode:"Hibrid", languages:["Azərbaycan dili","İngilis dili"], expertise:["Strategiya","Araşdırma"], status:"approved", visible:true },
  { kind:"mentor", slug:"murad-selimli", name:"Murad Səlimli", headline:"Yaradıcı texnologiyalar mentoru", specialty:"Yaradıcı texnologiyalar", biography:"Texnologiya ilə yaradıcı ideyaları işlək prototipə çevirir.", city:"Xankəndi", experienceYears:7, availability:"Bir gün ərzində cavab verir", meetingMode:"Əyani", languages:["Azərbaycan dili"], expertise:["Prototipləmə","Frontend"], status:"approved", visible:true },
  { kind:"mentor", slug:"pervin-necefova", name:"Pərvin Nəcəfova", headline:"Süni intellekt mentoru", specialty:"Məsuliyyətli süni intellekt", biography:"Məsuliyyətli AI layihələri üçün araşdırma və məhsul qərarlarını dəqiqləşdirir.", city:"Bakı", experienceYears:8, availability:"8 saat ərzində cavab verir", meetingMode:"Onlayn", languages:["Azərbaycan dili","İngilis dili"], expertise:["AI","Data"], status:"approved", visible:true },
  { kind:"mentor", slug:"kenan-memmedov", name:"Kənan Məmmədov", headline:"Sistem dizaynı mentoru", specialty:"Sistem dizaynı", biography:"Mürəkkəb texniki sistemləri aydın hissələrə bölməyə kömək edir.", city:"Bakı", experienceYears:10, availability:"6 saat ərzində cavab verir", meetingMode:"Hibrid", languages:["Azərbaycan dili"], expertise:["Arxitektura","Backend"], status:"approved", visible:true },
  { kind:"mentor", slug:"yegane-tahirova", name:"Yeganə Tahirova", headline:"Xidmət dizaynı mentoru", specialty:"Xidmət dizaynı", biography:"İstifadəçi ehtiyaclarını xidmət axınına çevirir.", city:"Xankəndi", experienceYears:7, availability:"Bir gün ərzində cavab verir", meetingMode:"Əyani", languages:["Azərbaycan dili"], expertise:["UX","Araşdırma"], status:"approved", visible:true },
  { kind:"mentor", slug:"sevinc-melikova", name:"Sevinc Məlikova", headline:"Karyera mentoru", specialty:"Yaradıcı karyera", biography:"Portfel, müsahibə və karyera istiqamətini planlaşdırmağa dəstək verir.", city:"Bakı", experienceYears:9, availability:"Bir gün ərzində cavab verir", meetingMode:"Onlayn", languages:["Azərbaycan dili","İngilis dili"], expertise:["Karyera","Portfel"], status:"approved", visible:true },
];

const memory = new Map<string, ProfessionalProfile>(
  seedProfiles.map((profile) => [profile.slug, { ...profile, id: randomUUID(), userId: null, rating: 0, reviewCount: 0, criteria: emptyCriteria() }]),
);

export function activateMemoryMentorProfile(input: {
  userId: string; name: string; specialty: string; biography: string;
  availability: string; meetingMode: string; languages: string[];
}) {
  if (databasePool) return;
  const slug = `mentor-${input.userId}`;
  memory.set(slug, {
    id: randomUUID(), userId: input.userId, kind: "mentor", slug, name: input.name,
    headline: `${input.specialty} mentoru`, specialty: input.specialty, biography: input.biography,
    city: "Xankəndi", experienceYears: 0, availability: input.availability,
    meetingMode: input.meetingMode, languages: input.languages, expertise: [input.specialty],
    rating: 0, reviewCount: 0, criteria: emptyCriteria(),
    status: "approved", visible: true,
  });
}

export async function seedProfessionalProfiles() {
  if (!databasePool || !env.SEED_DEMO_DATA) return;
  for (const profile of seedProfiles) {
    await databasePool.query(`INSERT INTO professional_profiles
      (id,kind,slug,display_name,headline,specialty,biography,city,experience_years,availability,meeting_mode,languages,expertise,status,visible)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (slug) DO NOTHING`,
      [randomUUID(),profile.kind,profile.slug,profile.name,profile.headline,profile.specialty,profile.biography,profile.city,profile.experienceYears,profile.availability,profile.meetingMode,profile.languages,profile.expertise,profile.status,profile.visible]);
  }
  await databasePool.query(`UPDATE teacher_reviews r SET teacher_profile_id=p.id FROM professional_profiles p
    WHERE r.teacher_profile_id IS NULL AND r.teacher_id=p.slug`);
  await databasePool.query(`UPDATE mentorship_requests r SET mentor_profile_id=p.id FROM professional_profiles p
    WHERE r.mentor_profile_id IS NULL AND r.mentor_id=p.slug`);
}

/**
 * `createUser` hər yeni hesaba bu "haqqında" cümləsini yazır. O, istifadəçinin
 * mətni deyil — peşəkar profilə bio kimi köçürülürdü və kataloqda müəllim və
 * mentorun özünü təqdimatı kimi görünürdü.
 */
const ABOUT_PLACEHOLDER = "EduRate icmasında universitet həyatını daha əlaqəli yaşamaq üçün buradayam.";

function cleanAbout(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed === ABOUT_PLACEHOLDER ? "" : trimmed;
}

function emptyCriteria() {
  return { clarity: 0, subjectKnowledge: 0, objectivity: 0, communication: 0 };
}

function map(row: Record<string, unknown>): ProfessionalProfile {
  return { id:String(row.id), userId:row.user_id ? String(row.user_id) : null, kind:row.kind as ProfessionalKind,
    slug:String(row.slug), name:String(row.display_name), headline:String(row.headline), specialty:String(row.specialty),
    biography:String(row.biography), city:String(row.city), experienceYears:Number(row.experience_years),
    availability:String(row.availability), meetingMode:String(row.meeting_mode), languages:Array.isArray(row.languages)?row.languages.map(String):[],
    expertise:Array.isArray(row.expertise)?row.expertise.map(String):[], rating:Number(row.rating ?? 0), reviewCount:Number(row.review_count ?? 0),
    criteria:{ clarity:Number(row.clarity ?? 0), subjectKnowledge:Number(row.subject_knowledge ?? 0), objectivity:Number(row.objectivity ?? 0), communication:Number(row.communication ?? 0) },
    status:row.status as ProfessionalProfile["status"], visible:Boolean(row.visible) };
}

export async function listProfessionalProfiles(kind?: ProfessionalKind, includeHidden=false) {
  if (!databasePool) return [...memory.values()].filter((p) => (!kind || p.kind===kind) && (includeHidden || (p.status==="approved" && p.visible)));
  const values: unknown[]=[]; const clauses:string[]=[];
  if (kind) { values.push(kind); clauses.push(`p.kind=$${values.length}`); }
  if (!includeHidden) clauses.push("p.status='approved' AND p.visible=TRUE");
  const result=await databasePool.query(`
    SELECT p.*,
      COALESCE(review_stats.rating, 0)::float AS rating,
      COALESCE(review_stats.review_count, 0)::int AS review_count,
      COALESCE(review_stats.clarity, 0)::float AS clarity,
      COALESCE(review_stats.subject_knowledge, 0)::float AS subject_knowledge,
      COALESCE(review_stats.objectivity, 0)::float AS objectivity,
      COALESCE(review_stats.communication, 0)::float AS communication
    FROM professional_profiles p
    LEFT JOIN (
      SELECT teacher_profile_id, AVG(rating) AS rating, COUNT(*) AS review_count,
        AVG(clarity) AS clarity, AVG(subject_knowledge) AS subject_knowledge,
        AVG(objectivity) AS objectivity, AVG(communication) AS communication
      FROM teacher_reviews
      WHERE status='approved' AND teacher_profile_id IS NOT NULL
      GROUP BY teacher_profile_id
    ) review_stats ON review_stats.teacher_profile_id=p.id
    ${clauses.length?`WHERE ${clauses.join(" AND ")}`:""}
    ORDER BY p.display_name`,values);
  return result.rows.map(map);
}

export async function findProfessionalProfile(idOrSlug:string, kind?:ProfessionalKind) {
  if (!databasePool) return [...memory.values()].find((p)=>(p.id===idOrSlug||p.slug===idOrSlug)&&(!kind||p.kind===kind))??null;
  const result=await databasePool.query(`SELECT * FROM professional_profiles WHERE (id::text=$1 OR slug=$1) ${kind?"AND kind=$2":""} LIMIT 1`,kind?[idOrSlug,kind]:[idOrSlug]);
  return result.rows[0]?map(result.rows[0]):null;
}

export async function findProfessionalByUser(userId:string, kind:ProfessionalKind) {
  if (!databasePool) return [...memory.values()].find((p)=>p.userId===userId&&p.kind===kind)??null;
  const result=await databasePool.query("SELECT * FROM professional_profiles WHERE user_id=$1 AND kind=$2 LIMIT 1",[userId,kind]);
  return result.rows[0]?map(result.rows[0]):null;
}

function shouldShowProfile(user: ProfessionalUser, profile: ProfessionalProfile) {
  if (user.status !== "Aktiv" || profile.status !== "approved") return false;
  if (user.role === "teacher") return profile.kind === "teacher" || profile.kind === "mentor";
  return user.role === "mentor" && profile.kind === "mentor";
}

function primaryKind(user: ProfessionalUser): ProfessionalKind | null {
  if (user.status !== "Aktiv") return null;
  return user.role === "teacher" || user.role === "mentor" ? user.role : null;
}

export async function synchronizeProfessionalProfilesForUser(user: ProfessionalUser) {
  const kind = primaryKind(user);

  if (!databasePool) {
    for (const [slug, profile] of memory.entries()) {
      if (profile.userId !== user.id) continue;
      const next: ProfessionalProfile = {
        ...profile,
        name: user.name,
        city: user.city,
        ...(profile.kind === "teacher" ? {
          headline: `${user.program} müəllimi`,
          specialty: user.program,
          biography: cleanAbout(user.about) || profile.biography,
        } : {}),
      };
      next.visible = shouldShowProfile(user, next);
      memory.set(slug, next);
    }

    if (!kind) return null;
    const existing = await findProfessionalByUser(user.id, kind);
    if (existing) return existing;
    const slug = `${kind}-${user.id}`;
    const created: ProfessionalProfile = {
      id: randomUUID(), userId: user.id, kind, slug, name: user.name,
      headline: `${user.program} ${kind === "teacher" ? "müəllimi" : "mentoru"}`,
      specialty: user.program, biography: cleanAbout(user.about), city: user.city,
      experienceYears: 0, availability: "", meetingMode: "Onlayn", languages: [],
      expertise: [user.program], rating: 0, reviewCount: 0, criteria: emptyCriteria(), status: "approved", visible: true,
    };
    memory.set(slug, created);
    return created;
  }

  await databasePool.query(
    `UPDATE professional_profiles SET
       display_name=$2, city=$3,
       headline=CASE WHEN kind='teacher' THEN $4 ELSE headline END,
       specialty=CASE WHEN kind='teacher' THEN $5 ELSE specialty END,
       biography=CASE WHEN kind='teacher' AND $6<>'' THEN $6 ELSE biography END,
       visible=CASE
         WHEN $7='Aktiv' AND status='approved' AND
           (($8='teacher' AND kind IN ('teacher','mentor')) OR ($8='mentor' AND kind='mentor'))
         THEN TRUE ELSE FALSE END,
       updated_at=NOW()
     WHERE user_id=$1`,
    [user.id, user.name, user.city, `${user.program} müəllimi`, user.program, cleanAbout(user.about), user.status, user.role],
  );

  if (!kind) return null;
  const slug = `${kind}-${user.id}`;
  const result = await databasePool.query(
    `INSERT INTO professional_profiles
       (id,user_id,kind,slug,display_name,headline,specialty,biography,city,expertise,status,visible)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'approved',TRUE)
     ON CONFLICT (user_id,kind) WHERE user_id IS NOT NULL DO UPDATE SET
       display_name=EXCLUDED.display_name, headline=EXCLUDED.headline,
       specialty=EXCLUDED.specialty,
       biography=CASE WHEN EXCLUDED.biography<>'' THEN EXCLUDED.biography ELSE professional_profiles.biography END,
       city=EXCLUDED.city, expertise=EXCLUDED.expertise,
       status='approved', visible=TRUE, updated_at=NOW()
     RETURNING *`,
    [randomUUID(), user.id, kind, slug, user.name,
      `${user.program} ${kind === "teacher" ? "müəllimi" : "mentoru"}`,
      user.program, cleanAbout(user.about), user.city, [user.program]],
  );
  return map(result.rows[0]);
}

export async function ensureProfessionalProfileForUser(user: ProfessionalUser) {
  return synchronizeProfessionalProfilesForUser(user);
}

export type MentorDetailsInput = {
  availability: string;
  meetingMode: "Onlayn" | "Əyani" | "Hibrid";
  languages: string[];
  experienceYears: number;
};

/**
 * Mentorun kataloqda görünən praktik məlumatları. Əvvəl bunları heç kim
 * dəyişə bilmirdi: admin tərəfindən mentor edilən istifadəçinin profili
 * boş qalırdı ("uyğun vaxtı mentorla dəqiqləşdir", dil yoxdur, təcrübə yoxdur),
 * təsdiqlənmiş müəllim-mentor isə müraciətdə yazdığını sonra dəyişə bilmirdi.
 * Bu sütunlara profil sinxronizasiyası toxunmur, ona görə dəyişiklik qalır.
 */
export async function updateMentorDetails(userId: string, input: MentorDetailsInput) {
  if (!databasePool) {
    for (const [slug, profile] of memory.entries()) {
      if (profile.userId !== userId || profile.kind !== "mentor") continue;
      const next: ProfessionalProfile = { ...profile, ...input };
      memory.set(slug, next);
      return next;
    }
    return null;
  }
  const result = await databasePool.query(
    `UPDATE professional_profiles
        SET availability=$2, meeting_mode=$3, languages=$4, experience_years=$5, updated_at=NOW()
      WHERE user_id=$1 AND kind='mentor'
      RETURNING *`,
    [userId, input.availability, input.meetingMode, input.languages, input.experienceYears],
  );
  return result.rows[0] ? map(result.rows[0]) : null;
}

export async function deactivateProfessionalProfilesForUser(userId: string) {
  if (!databasePool) {
    for (const [slug, profile] of memory.entries()) {
      if (profile.userId === userId) memory.set(slug, { ...profile, visible: false });
    }
    return;
  }
  await databasePool.query(
    "UPDATE professional_profiles SET visible=FALSE, updated_at=NOW() WHERE user_id=$1",
    [userId],
  );
}

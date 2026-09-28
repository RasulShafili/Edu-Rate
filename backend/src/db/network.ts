import { randomUUID } from "node:crypto";
import { databasePool, findUserById } from "./database.js";
import { env } from "../config/env.js";
import { getMedia } from "./media.js";
import { countAnnouncementComments } from "./announcement-comments.js";

export type NetworkCategory = "official" | "faculties" | "clubs" | "scholarship" | "events";
export type NetworkTone = "lime" | "lilac" | "blue" | "coral" | "mint" | "gold";

export type AnnouncementRecord = {
  id: string;
  kind: "announcement";
  category: NetworkCategory;
  title: string;
  summary: string;
  source: string;
  sourceInitials: string;
  publishedAt: string;
  timeLabel: string;
  tone: NetworkTone;
  dateLabel: string;
  startsAt: string;
  expiresAt: string;
  priority: boolean;
  imageUrl?: string;
  viewCount?: number;
  reactions?: Record<string, number>;
  myReaction?: string | null;
  createdBy?: string | null;
  read?: boolean;
  bookmarked?: boolean;
};

export type AnnouncementReactionRecord = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  emoji: string;
  reactedAt: string;
};

export type FeedRecord = Omit<AnnouncementRecord, "kind" | "dateLabel" | "startsAt" | "expiresAt" | "priority"> & {
  kind: "post" | "news" | "notification";
  tags: string[];
};

const announcements: AnnouncementRecord[] = [
  { id: "2026-orientation", kind: "announcement", category: "official", title: "Yeni tələbələr üçün tanışlıq proqramı", summary: "Kampus turu, tələbə xidmətləri və klublarla tanışlıq görüşü 18 avqustda keçiriləcək.", source: "Tələbə İşləri Mərkəzi", sourceInitials: "Tİ", publishedAt: "2026-08-10T09:00:00+04:00", timeLabel: "10 avqust · 09:00", tone: "lime", dateLabel: "18 avqust", startsAt: "2026-08-18T10:00:00+04:00", expiresAt: "2026-08-18T18:00:00+04:00", priority: true },
  { id: "2026-scholarship", kind: "announcement", category: "scholarship", title: "Akademik təqaüd müraciətləri açıqdır", summary: "Elektron müraciət və tələb olunan sənədlər 25 avqust saat 18:00-dək qəbul edilir.", source: "Tələbə İşləri Mərkəzi", sourceInitials: "Tİ", publishedAt: "2026-08-09T11:20:00+04:00", timeLabel: "9 avqust · 11:20", tone: "gold", dateLabel: "25 avqust", startsAt: "2026-08-09T11:20:00+04:00", expiresAt: "2026-08-25T18:00:00+04:00", priority: true },
  { id: "2026-robotics-lab", kind: "announcement", category: "clubs", title: "Robototexnika klubunda açıq laboratoriya", summary: "Sensorlar və kiçik robotlarla praktik görüş üçün ilkin təcrübə tələb olunmur.", source: "Robototexnika Klubu", sourceInitials: "RK", publishedAt: "2026-08-08T14:00:00+04:00", timeLabel: "8 avqust · 14:00", tone: "blue", dateLabel: "20 avqust", startsAt: "2026-08-20T14:00:00+04:00", expiresAt: "2026-08-20T17:00:00+04:00", priority: false },
];

const feed: FeedRecord[] = [
  { id: "library-hours-august", kind: "news", category: "official", title: "Kitabxananın iş saatları uzadıldı", summary: "İmtahan hazırlığı dövründə əsas oxu zalı həftəiçi saat 22:00-dək açıq olacaq.", source: "Universitet Kitabxanası", sourceInitials: "UK", publishedAt: "2026-08-10T10:20:00+04:00", timeLabel: "10 avqust · 10:20", tone: "lime", tags: ["Kitabxana", "İmtahan"] },
  { id: "frontend-team-august", kind: "post", category: "clubs", title: "Frontend layihəsi üçün komanda yoldaşı axtarılır", summary: "Kampus tədbirlərini əlçatan göstərən React layihəsi üçün dizayn düşüncəsi olan tələbə axtarılır.", source: "Proqramlaşdırma Klubu", sourceInitials: "PK", publishedAt: "2026-08-10T09:55:00+04:00", timeLabel: "10 avqust · 09:55", tone: "blue", tags: ["React", "Komanda"] },
  { id: "engineering-showcase-august", kind: "news", category: "faculties", title: "Mühəndislik layihələrinin açıq nümayişi", summary: "Tələbə komandaları işlək prototiplərini təqdim edəcək və ziyarətçilərdən rəy alacaq.", source: "Mühəndislik Fakültəsi", sourceInitials: "MF", publishedAt: "2026-08-09T16:10:00+04:00", timeLabel: "9 avqust · 16:10", tone: "lilac", tags: ["Layihə", "Mühəndislik"] },
  { id: "digital-safety-august", kind: "news", category: "official", title: "Rəqəmsal təhlükəsizlik bələdçisi yeniləndi", summary: "Hesab qorunması və şəxsi məlumatların təhlükəsiz paylaşılması üçün əsas addımlar bir səhifədə toplanıb.", source: "İnformasiya Təhlükəsizliyi", sourceInitials: "İT", publishedAt: "2026-08-09T12:30:00+04:00", timeLabel: "9 avqust · 12:30", tone: "mint", tags: ["Təhlükəsizlik", "Bələdçi"] },
  { id: "debate-intake-august", kind: "notification", category: "clubs", title: "Debat klubuna yeni üzv qəbulu", summary: "Açıq məşqdə klubun iş tərzi və həftəlik proqramı ilə tanış ola bilərsən.", source: "Debat Klubu", sourceInitials: "DK", publishedAt: "2026-08-08T18:40:00+04:00", timeLabel: "8 avqust · 18:40", tone: "coral", tags: ["Debat", "Üzvlük"] },
];

type FeedStatus = "pending" | "published" | "rejected";
export type AdminFeedRecord = FeedRecord & { status: FeedStatus; userId: string | null };
const memoryAnnouncements = new Map<string, AnnouncementRecord & { status: "draft" | "published" }>(
  announcements.map((item) => [item.id, { ...item, status: "published" }]),
);
const memoryFeed = new Map<string, AdminFeedRecord>(
  feed.map((item) => [item.id, { ...item, status: "published", userId: null }]),
);
const memoryAnnouncementViews = new Map<string, Set<string>>();
const memoryAnnouncementReactions = new Map<string, Map<string, string>>();
const memoryAnnouncementState = new Map<string, {read:boolean;bookmarked:boolean}>();

export const BASE_NETWORK_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(120) PRIMARY KEY, category VARCHAR(24) NOT NULL, title VARCHAR(180) NOT NULL,
      summary VARCHAR(800) NOT NULL, source VARCHAR(140) NOT NULL, source_initials VARCHAR(8) NOT NULL,
      published_at TIMESTAMPTZ NOT NULL, tone VARCHAR(16) NOT NULL, starts_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, priority BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS announcements_published_at_idx ON announcements (published_at DESC);
    CREATE TABLE IF NOT EXISTS feed_posts (
      id VARCHAR(120) PRIMARY KEY, kind VARCHAR(24) NOT NULL, category VARCHAR(24) NOT NULL,
      title VARCHAR(180) NOT NULL, summary VARCHAR(800) NOT NULL, source VARCHAR(140) NOT NULL,
      source_initials VARCHAR(8) NOT NULL, published_at TIMESTAMPTZ NOT NULL, tone VARCHAR(16) NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS feed_posts_published_at_idx ON feed_posts (published_at DESC);
  `;

export async function initializeNetworkDatabase() {
  if (!databasePool) return;
  await databasePool.query(BASE_NETWORK_SCHEMA_SQL);
  if (env.SEED_DEMO_DATA) for (const item of announcements) {
    await databasePool.query(`INSERT INTO announcements
      (id, category, title, summary, source, source_initials, published_at, tone, starts_at, expires_at, priority)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [item.id, item.category, item.title, item.summary, item.source, item.sourceInitials, item.publishedAt, item.tone, item.startsAt, item.expiresAt, item.priority]);
  }
  if (env.SEED_DEMO_DATA) for (const item of feed) {
    await databasePool.query(`INSERT INTO feed_posts
      (id, kind, category, title, summary, source, source_initials, published_at, tone, tags)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [item.id, item.kind, item.category, item.title, item.summary, item.source, item.sourceInitials, item.publishedAt, item.tone, item.tags]);
  }
}

export async function listAnnouncements(category?: NetworkCategory,userId?:string): Promise<AnnouncementRecord[]> {
  if (!databasePool) return Promise.all([...memoryAnnouncements.values()].filter((item) => item.status === "published" && (!category || item.category === category)).map(async(item)=>{const reactionMap=memoryAnnouncementReactions.get(item.id)??new Map();const reactions:Record<string,number>={};for(const emoji of reactionMap.values())reactions[emoji]=(reactions[emoji]??0)+1;const state=userId?memoryAnnouncementState.get(`${item.id}:${userId}`):undefined;return {...item,imageUrl:(await getMedia("announcement",item.id))?.secureUrl,viewCount:memoryAnnouncementViews.get(item.id)?.size??0,reactions,myReaction:userId?reactionMap.get(userId)??null:null,commentCount:await countAnnouncementComments(item.id),read:state?.read??false,bookmarked:state?.bookmarked??false};}));
  const result = await databasePool.query(
    `SELECT announcements.*,media_assets.secure_url image_url,
      (SELECT COUNT(*)::int FROM announcement_views WHERE announcement_id=announcements.id) view_count,
      COALESCE((SELECT jsonb_object_agg(emoji,total) FROM (SELECT emoji,COUNT(*)::int total FROM announcement_reactions WHERE announcement_id=announcements.id GROUP BY emoji) r),'{}'::jsonb) reactions,
      (SELECT emoji FROM announcement_reactions WHERE announcement_id=announcements.id AND user_id=$1) my_reaction,
      (SELECT COUNT(*)::int FROM announcement_comments WHERE announcement_id=announcements.id) comment_count
      ,COALESCE((SELECT is_read FROM announcement_user_state WHERE announcement_id=announcements.id AND user_id=$1),FALSE) is_read
      ,COALESCE((SELECT is_bookmarked FROM announcement_user_state WHERE announcement_id=announcements.id AND user_id=$1),FALSE) is_bookmarked
     FROM announcements LEFT JOIN media_assets ON media_assets.owner_type='announcement' AND media_assets.owner_id=announcements.id WHERE status='published' ${category ? "AND category = $2" : ""} ORDER BY priority DESC, published_at DESC`,
    category ? [userId??null,category] : [userId??null],
  );
  return result.rows.map((row) => ({ id: String(row.id), kind: "announcement", category: row.category, title: String(row.title), summary: String(row.summary), source: String(row.source), sourceInitials: String(row.source_initials), publishedAt: new Date(row.published_at).toISOString(), timeLabel: formatTime(row.published_at), tone: row.tone, dateLabel: formatDate(row.starts_at), startsAt: new Date(row.starts_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(), priority: Boolean(row.priority),imageUrl:row.image_url?String(row.image_url):undefined,viewCount:Number(row.view_count??0),reactions:row.reactions&&typeof row.reactions==="object"?row.reactions:{},myReaction:row.my_reaction?String(row.my_reaction):null,commentCount:Number(row.comment_count??0),createdBy:row.created_by?String(row.created_by):null,read:Boolean(row.is_read),bookmarked:Boolean(row.is_bookmarked) }));
}

export async function setAnnouncementUserState(announcementId:string,userId:string,input:{read?:boolean;bookmarked?:boolean}){
  if(!databasePool){const key=`${announcementId}:${userId}`;const current=memoryAnnouncementState.get(key)??{read:false,bookmarked:false};const next={read:input.read??current.read,bookmarked:input.bookmarked??current.bookmarked};memoryAnnouncementState.set(key,next);return next;}
  const result=await databasePool.query(`INSERT INTO announcement_user_state(announcement_id,user_id,is_read,is_bookmarked)
    VALUES($1,$2,COALESCE($3,FALSE),COALESCE($4,FALSE)) ON CONFLICT(announcement_id,user_id) DO UPDATE SET
    is_read=COALESCE($3,announcement_user_state.is_read),is_bookmarked=COALESCE($4,announcement_user_state.is_bookmarked),updated_at=NOW()
    RETURNING is_read,is_bookmarked`,[announcementId,userId,input.read??null,input.bookmarked??null]);
  return {read:Boolean(result.rows[0]?.is_read),bookmarked:Boolean(result.rows[0]?.is_bookmarked)};
}

export async function recordAnnouncementView(announcementId:string,userId:string){if(!databasePool){const views=memoryAnnouncementViews.get(announcementId)??new Set<string>();views.add(userId);memoryAnnouncementViews.set(announcementId,views);return views.size;}const result=await databasePool.query("INSERT INTO announcement_views(announcement_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[announcementId,userId]);if(!result.rowCount){const count=await databasePool.query("SELECT COUNT(*)::int count FROM announcement_views WHERE announcement_id=$1",[announcementId]);return Number(count.rows[0]?.count??0);}const count=await databasePool.query("SELECT COUNT(*)::int count FROM announcement_views WHERE announcement_id=$1",[announcementId]);return Number(count.rows[0]?.count??0);}
export async function setAnnouncementReaction(announcementId:string,userId:string,emoji:string|null){if(!databasePool){const values=memoryAnnouncementReactions.get(announcementId)??new Map<string,string>();if(emoji)values.set(userId,emoji);else values.delete(userId);memoryAnnouncementReactions.set(announcementId,values);return;}if(!emoji){await databasePool.query("DELETE FROM announcement_reactions WHERE announcement_id=$1 AND user_id=$2",[announcementId,userId]);return;}await databasePool.query("INSERT INTO announcement_reactions(announcement_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT(announcement_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji,updated_at=NOW()",[announcementId,userId,emoji]);}

export async function listAnnouncementReactions(announcementId:string):Promise<AnnouncementReactionRecord[]>{
  if(!databasePool){
    const values=memoryAnnouncementReactions.get(announcementId)??new Map<string,string>();
    return Promise.all([...values.entries()].map(async([userId,emoji])=>{
      const user=await findUserById(userId);
      const avatar=await getMedia("avatar",userId);
      return {userId,name:user?.name??"İstifadəçi",avatarUrl:avatar?.secureUrl??null,emoji,reactedAt:new Date(0).toISOString()};
    }));
  }
  const result=await databasePool.query(`SELECT reactions.user_id,reactions.emoji,reactions.updated_at,users.name,media_assets.secure_url avatar_url
    FROM announcement_reactions reactions
    JOIN users ON users.id=reactions.user_id
    LEFT JOIN media_assets ON media_assets.owner_type='avatar' AND media_assets.owner_id=users.id::text
    WHERE reactions.announcement_id=$1
    ORDER BY reactions.updated_at DESC,users.name ASC`,[announcementId]);
  return result.rows.map((row)=>({userId:String(row.user_id),name:String(row.name),avatarUrl:row.avatar_url?String(row.avatar_url):null,emoji:String(row.emoji),reactedAt:new Date(row.updated_at).toISOString()}));
}

export async function getAnnouncementReactionState(announcementId:string,userId?:string){
  const people=await listAnnouncementReactions(announcementId);
  const reactions:Record<string,number>={};
  for(const person of people)reactions[person.emoji]=(reactions[person.emoji]??0)+1;
  return {reactions,myReaction:userId?people.find((person)=>person.userId===userId)?.emoji??null:null,people};
}

export async function listFeed(category?: NetworkCategory): Promise<FeedRecord[]> {
  if (!databasePool) return [...memoryFeed.values()].filter((item) => item.status === "published" && (!category || item.category === category));
  const result = await databasePool.query(
    `SELECT * FROM feed_posts WHERE status='published' ${category ? "AND category = $1" : ""} ORDER BY published_at DESC LIMIT 100`,
    category ? [category] : [],
  );
  return result.rows.map((row) => ({ id: String(row.id), kind: row.kind, category: row.category, title: String(row.title), summary: String(row.summary), source: String(row.source), sourceInitials: String(row.source_initials), publishedAt: new Date(row.published_at).toISOString(), timeLabel: formatTime(row.published_at), tone: row.tone, tags: Array.isArray(row.tags) ? row.tags.map(String) : [] }));
}

export type AnnouncementInput={category:NetworkCategory;title:string;summary:string;source:string;sourceInitials:string;tone:NetworkTone;startsAt:string;expiresAt:string;priority:boolean;status:"draft"|"published"};
export async function listAdminAnnouncements(){if(!databasePool)return Promise.all([...memoryAnnouncements.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).map(async(item)=>({...item,imageUrl:(await getMedia("announcement",item.id))?.secureUrl})));const result=await databasePool.query("SELECT announcements.*,media_assets.secure_url image_url FROM announcements LEFT JOIN media_assets ON media_assets.owner_type='announcement' AND media_assets.owner_id=announcements.id ORDER BY published_at DESC");return result.rows.map((row)=>({id:String(row.id),kind:"announcement",category:row.category,title:String(row.title),summary:String(row.summary),source:String(row.source),sourceInitials:String(row.source_initials),publishedAt:new Date(row.published_at).toISOString(),timeLabel:formatTime(row.published_at),tone:row.tone,dateLabel:formatDate(row.starts_at),startsAt:new Date(row.starts_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),priority:Boolean(row.priority),status:row.status,imageUrl:row.image_url?String(row.image_url):undefined,createdBy:row.created_by?String(row.created_by):null}));}
export async function findAnnouncementById(id:string){if(!databasePool)return memoryAnnouncements.get(id)??null;const result=await databasePool.query("SELECT * FROM announcements WHERE id=$1 LIMIT 1",[id]);if(!result.rows[0])return null;const row=result.rows[0];return{id:String(row.id),status:String(row.status),title:String(row.title),createdBy:row.created_by?String(row.created_by):null};}
export async function createAnnouncement(input:AnnouncementInput,createdBy:string|null=null){const id=randomUUID();const publishedAt=new Date().toISOString();if(!databasePool){const item={id,kind:"announcement" as const,...input,publishedAt,timeLabel:formatTime(publishedAt),dateLabel:formatDate(input.startsAt),createdBy};memoryAnnouncements.set(id,item);return item;}const result=await databasePool.query(`INSERT INTO announcements(id,category,title,summary,source,source_initials,published_at,tone,starts_at,expires_at,priority,status,created_by) VALUES($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11,$12) RETURNING *`,[id,input.category,input.title,input.summary,input.source,input.sourceInitials,input.tone,input.startsAt,input.expiresAt,input.priority,input.status,createdBy]);return result.rows[0];}
export async function updateAnnouncement(id:string,input:Partial<AnnouncementInput>){if(!databasePool){const current=memoryAnnouncements.get(id);if(!current)return null;const next={...current,...input};memoryAnnouncements.set(id,next);return next;}const result=await databasePool.query(`UPDATE announcements SET category=COALESCE($2,category),title=COALESCE($3,title),summary=COALESCE($4,summary),source=COALESCE($5,source),source_initials=COALESCE($6,source_initials),tone=COALESCE($7,tone),starts_at=COALESCE($8,starts_at),expires_at=COALESCE($9,expires_at),priority=COALESCE($10,priority),status=COALESCE($11,status) WHERE id=$1 RETURNING *`,[id,input.category,input.title,input.summary,input.source,input.sourceInitials,input.tone,input.startsAt,input.expiresAt,input.priority,input.status]);return result.rows[0]??null;}
export async function deleteAnnouncement(id:string){if(!databasePool)return memoryAnnouncements.delete(id);const result=await databasePool.query("DELETE FROM announcements WHERE id=$1",[id]);return Boolean(result.rowCount);}
export async function createFeedPost(userId:string,input:{title:string;summary:string;tags:string[]},source:string){const id=randomUUID();const initials=source.split(/\s+/).slice(0,2).map((part)=>part[0]?.toLocaleUpperCase("az")).join("");if(!databasePool){const item:AdminFeedRecord={id,kind:"post",category:"clubs",...input,source,sourceInitials:initials,publishedAt:new Date().toISOString(),timeLabel:"indi",tone:"blue",status:"pending",userId};memoryFeed.set(id,item);return item;}const result=await databasePool.query(`INSERT INTO feed_posts(id,kind,category,title,summary,source,source_initials,published_at,tone,tags,status,user_id) VALUES($1,'post','clubs',$2,$3,$4,$5,NOW(),'blue',$6,'pending',$7) RETURNING *`,[id,input.title,input.summary,source,initials,input.tags,userId]);return result.rows[0];}

/** İstifadəçinin göndərdiyi elanlar — dərc olunana qədər ictimai siyahıda görünmür. */
export async function listAnnouncementsByCreator(userId: string) {
  if (!databasePool) {
    return [...memoryAnnouncements.values()]
      .filter((item) => item.createdBy === userId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 30)
      .map((item) => ({ id: item.id, title: item.title, category: item.category, status: item.status, createdAt: item.publishedAt }));
  }
  const result = await databasePool.query(
    "SELECT id, title, category, status, published_at FROM announcements WHERE created_by = $1 ORDER BY published_at DESC LIMIT 30",
    [userId],
  );
  return result.rows.map((row) => ({ id: String(row.id), title: String(row.title), category: String(row.category), status: String(row.status), createdAt: new Date(row.published_at).toISOString() }));
}

/** İstifadəçinin lent paylaşımları: gözləyən, dərc olunan və rədd edilən. */
export async function listFeedPostsByAuthor(userId: string) {
  if (!databasePool) {
    return [...memoryFeed.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 30)
      .map((item) => ({ id: item.id, title: item.title, status: item.status, createdAt: item.publishedAt }));
  }
  const result = await databasePool.query(
    "SELECT id, title, status, published_at FROM feed_posts WHERE user_id = $1 ORDER BY published_at DESC LIMIT 30",
    [userId],
  );
  return result.rows.map((row) => ({ id: String(row.id), title: String(row.title), status: String(row.status), createdAt: new Date(row.published_at).toISOString() }));
}

export async function listAdminFeed(status?: FeedStatus) {
  if (!databasePool) return [...memoryFeed.values()].filter((item) => !status || item.status === status).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  const result=await databasePool.query(`SELECT * FROM feed_posts ${status?"WHERE status=$1":""} ORDER BY published_at DESC LIMIT 200`,status?[status]:[]);
  return result.rows;
}

export async function updateFeedPostStatus(id:string,status:FeedStatus){
  if(!databasePool){const current=memoryFeed.get(id);if(!current)return null;const next={...current,status};memoryFeed.set(id,next);return next;}
  const result=await databasePool.query("UPDATE feed_posts SET status=$2 WHERE id=$1 RETURNING *",[id,status]);
  return result.rows[0]??null;
}

export async function deleteFeedPost(id:string){
  if(!databasePool)return memoryFeed.delete(id);
  const result=await databasePool.query("DELETE FROM feed_posts WHERE id=$1",[id]);
  return Boolean(result.rowCount);
}

function formatDate(value: unknown) {
  return new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long", timeZone: "Asia/Baku" }).format(new Date(String(value)));
}

function formatTime(value: unknown) {
  return new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku" }).format(new Date(String(value))).replace(" tarixində", " ·");
}

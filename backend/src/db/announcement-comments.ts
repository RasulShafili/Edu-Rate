import { randomUUID } from "node:crypto";
import { databasePool, findUserById } from "./database.js";
import { getMedia } from "./media.js";
import { ApiError } from "../lib/api-error.js";

/**
 * Elan şərhləri. Anonim şərhdə müəllifin kimliyi (ad, şəkil, id) API cavabına
 * ümumiyyətlə düşmür — gizlilik yalnız interfeysdə deyil, serverdə təmin olunur.
 * Müəllif öz şərhini `mine` bayrağı ilə tanıyır və silə bilir.
 */
export type AnnouncementComment = {
  id: string;
  body: string;
  anonymous: boolean;
  author: { name: string; avatarUrl?: string } | null;
  mine: boolean;
  createdAt: string;
};

type StoredComment = { id: string; announcementId: string; authorId: string; body: string; anonymous: boolean; createdAt: string };
const memory = new Map<string, StoredComment[]>();
const MAX_COMMENTS = 200;

export async function listAnnouncementComments(announcementId: string, viewerId?: string): Promise<AnnouncementComment[]> {
  if (!databasePool) {
    const items = memory.get(announcementId) ?? [];
    return Promise.all(items.map(async (item) => {
      const author = item.anonymous ? null : await findUserById(item.authorId);
      const avatarUrl = author ? (await getMedia("avatar", item.authorId))?.secureUrl : undefined;
      return {
        id: item.id,
        body: item.body,
        anonymous: item.anonymous,
        author: author ? { name: author.name, ...(avatarUrl ? { avatarUrl } : {}) } : null,
        mine: Boolean(viewerId && item.authorId === viewerId),
        createdAt: item.createdAt,
      };
    }));
  }
  const result = await databasePool.query(
    `SELECT c.id, c.body, c.anonymous, c.author_id, c.created_at, u.name, m.secure_url avatar_url
       FROM announcement_comments c
       JOIN users u ON u.id = c.author_id
       LEFT JOIN media_assets m ON m.owner_type = 'avatar' AND m.owner_id = u.id::text
      WHERE c.announcement_id = $1
      ORDER BY c.created_at ASC, c.id ASC
      LIMIT $2`,
    [announcementId, MAX_COMMENTS],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    body: String(row.body),
    anonymous: Boolean(row.anonymous),
    author: row.anonymous ? null : { name: String(row.name), ...(row.avatar_url ? { avatarUrl: String(row.avatar_url) } : {}) },
    mine: Boolean(viewerId && String(row.author_id) === viewerId),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function countAnnouncementComments(announcementId: string): Promise<number> {
  if (!databasePool) return memory.get(announcementId)?.length ?? 0;
  const result = await databasePool.query("SELECT COUNT(*)::int AS count FROM announcement_comments WHERE announcement_id=$1", [announcementId]);
  return Number(result.rows[0]?.count ?? 0);
}

export async function createAnnouncementComment(announcementId: string, authorId: string, body: string, anonymous: boolean) {
  const comment: StoredComment = { id: randomUUID(), announcementId, authorId, body, anonymous, createdAt: new Date().toISOString() };
  if (!databasePool) {
    const items = memory.get(announcementId) ?? [];
    if (items.length >= MAX_COMMENTS) throw new ApiError(409, "COMMENT_LIMIT", "Bu elana şərh limiti dolub.");
    items.push(comment);
    memory.set(announcementId, items);
    return comment;
  }
  const inserted = await databasePool.query(
    `INSERT INTO announcement_comments(id, announcement_id, author_id, body, anonymous)
     SELECT $1::uuid, $2::varchar, $3::uuid, $4::varchar, $5::boolean
      WHERE (SELECT COUNT(*) FROM announcement_comments WHERE announcement_id = $2::varchar) < $6::int
     RETURNING created_at`,
    [comment.id, announcementId, authorId, body, anonymous, MAX_COMMENTS],
  );
  if (!inserted.rowCount) throw new ApiError(409, "COMMENT_LIMIT", "Bu elana şərh limiti dolub.");
  return { ...comment, createdAt: new Date(inserted.rows[0].created_at).toISOString() };
}

/** Müəllif öz şərhini, moderator istənilən şərhi silir. */
export async function deleteAnnouncementComment(announcementId: string, commentId: string, userId: string, isModerator: boolean): Promise<boolean> {
  if (!databasePool) {
    const items = memory.get(announcementId) ?? [];
    const index = items.findIndex((item) => item.id === commentId && (isModerator || item.authorId === userId));
    if (index < 0) return false;
    items.splice(index, 1);
    return true;
  }
  const result = await databasePool.query(
    "DELETE FROM announcement_comments WHERE id=$1 AND announcement_id=$2 AND ($4::boolean OR author_id=$3)",
    [commentId, announcementId, userId, isModerator],
  );
  return Boolean(result.rowCount);
}

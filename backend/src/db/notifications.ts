import { randomUUID } from "node:crypto";
import { databasePool } from "./database.js";
import { sendPush } from "./push.js";
import { publishToUser } from "../realtime.js";

/**
 * Şəxsi bildirişlər. Əvvəl platformada yeganə bildiriş elanlar üçün push idi:
 * sualına cavab gələndə, mentorluq müraciəti qəbul/rədd ediləndə, tədbiri və ya
 * klubu təsdiqlənəndə, dəstək müraciəti yenilənəndə istifadəçi bundan xəbər
 * tutmurdu. Mətn saxlanmır — `kind` + parametrlər; interfeys onu seçilmiş
 * dildə qurur.
 */
export const NOTIFICATION_KINDS = [
  "question_answered",
  "mentorship_request",
  "mentorship_accepted",
  "mentorship_rejected",
  "event_published",
  "club_approved",
  "support_updated",
  "connection_accepted",
  "event_cancelled",
  "event_changed",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationParams = Record<string, string>;
export type NotificationRecord = {
  id: string;
  kind: NotificationKind;
  params: NotificationParams;
  url: string;
  readAt: string | null;
  createdAt: string;
};

const KEEP_PER_USER = 100;
const memory = new Map<string, Array<NotificationRecord & { userId: string }>>();

/** Push mətni (telefonun bildiriş zolağı üçün) — serverdə dil məlum deyil. */
const pushTitles: Record<NotificationKind, (params: NotificationParams) => string> = {
  question_answered: (p) => `Sualına cavab gəldi: ${p.title ?? ""}`,
  mentorship_request: (p) => `Yeni mentorluq müraciəti: ${p.name ?? ""}`,
  mentorship_accepted: (p) => `${p.name ?? "Mentor"} mentorluq müraciətini qəbul etdi`,
  mentorship_rejected: (p) => `${p.name ?? "Mentor"} mentorluq müraciətini rədd etdi`,
  event_published: (p) => `Tədbirin yayımlandı: ${p.title ?? ""}`,
  club_approved: (p) => `Klubun təsdiqləndi: ${p.name ?? ""}`,
  support_updated: (p) => `Dəstək müraciəti ${p.reference ?? ""} yeniləndi`,
  connection_accepted: (p) => `${p.name ?? ""} əlaqə sorğunu qəbul etdi`,
  event_cancelled: (p) => `Tədbir ləğv olundu: ${p.title ?? ""}`,
  event_changed: (p) => `Tədbirin vaxtı və ya yeri dəyişdi: ${p.title ?? ""}`,
};

function clean(params: NotificationParams): NotificationParams {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value).slice(0, 160)]));
}

/**
 * Bildiriş yaradır, istifadəçiyə canlı çatdırır və push göndərir. Əsas əməliyyatı
 * heç vaxt pozmur: xəta olsa yalnız jurnala yazılır. Özünə bildiriş göndərilmir.
 */
export async function notifyUser(
  userId: string | null | undefined,
  kind: NotificationKind,
  params: NotificationParams,
  url: string,
  actorId?: string,
): Promise<NotificationRecord | null> {
  if (!userId || userId === actorId) return null;
  try {
    const record: NotificationRecord = { id: randomUUID(), kind, params: clean(params), url, readAt: null, createdAt: new Date().toISOString() };
    if (!databasePool) {
      const list = memory.get(userId) ?? [];
      list.unshift({ ...record, userId });
      memory.set(userId, list.slice(0, KEEP_PER_USER));
    } else {
      await databasePool.query(
        "INSERT INTO notifications(id,user_id,kind,params,url) VALUES($1,$2,$3,$4::jsonb,$5)",
        [record.id, userId, kind, JSON.stringify(record.params), url],
      );
      // Köhnə qeydlər sonsuz yığılmasın.
      await databasePool.query(
        `DELETE FROM notifications WHERE user_id=$1 AND id IN (
           SELECT id FROM notifications WHERE user_id=$1 ORDER BY created_at DESC OFFSET $2)`,
        [userId, KEEP_PER_USER],
      );
    }
    publishToUser(userId, "notification:new", record);
    void sendPush({ title: pushTitles[kind](record.params), body: "EduRate", url, tag: `notification-${record.id}` }, [userId]).catch(() => undefined);
    return record;
  } catch (error) {
    console.error("Bildiriş yaradılmadı:", error);
    return null;
  }
}

function mapRow(row: Record<string, unknown>): NotificationRecord {
  return {
    id: String(row.id),
    kind: row.kind as NotificationKind,
    params: (row.params ?? {}) as NotificationParams,
    url: String(row.url),
    readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function listNotifications(userId: string, limit = 30): Promise<{ items: NotificationRecord[]; unread: number }> {
  if (!databasePool) {
    const list = memory.get(userId) ?? [];
    return {
      items: list.slice(0, limit).map(({ userId: _owner, ...item }) => item),
      unread: list.filter((item) => !item.readAt).length,
    };
  }
  const [items, unread] = await Promise.all([
    databasePool.query("SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2", [userId, limit]),
    databasePool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL", [userId]),
  ]);
  return { items: items.rows.map(mapRow), unread: Number(unread.rows[0]?.count ?? 0) };
}

export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  if (!databasePool) {
    const item = (memory.get(userId) ?? []).find((entry) => entry.id === id);
    if (!item) return false;
    item.readAt ??= new Date().toISOString();
    return true;
  }
  const result = await databasePool.query(
    "UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, userId],
  );
  return Boolean(result.rowCount);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  if (!databasePool) {
    let count = 0;
    for (const item of memory.get(userId) ?? []) if (!item.readAt) { item.readAt = new Date().toISOString(); count += 1; }
    return count;
  }
  const result = await databasePool.query("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL", [userId]);
  return result.rowCount ?? 0;
}

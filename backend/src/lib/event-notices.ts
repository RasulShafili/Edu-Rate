import { listEventRegistrantIds, type EventRecord } from "../db/business.js";
import { notifyUser } from "../db/notifications.js";

/** Tədbir ləğv olunanda (silinəndə) yazılmış iştirakçılara xəbər verir. */
export async function noticeEventCancelled(event: EventRecord, actorId: string) {
  const registrants = await listEventRegistrantIds(event.id);
  await Promise.all(registrants.map((userId) => notifyUser(userId, "event_cancelled", { title: event.title }, "/events", actorId)));
}

/**
 * Vaxt və ya yer dəyişəndə iştirakçı bunu bilməlidir — əks halda köhnə vaxtda
 * köhnə yerə gəlir. Başqa sahələrin dəyişməsi bildiriş yaratmır.
 */
export async function noticeEventChanged(before: EventRecord, after: EventRecord, actorId: string) {
  const changed = before.startAt !== after.startAt || before.endAt !== after.endAt
    || before.location !== after.location || before.city !== after.city;
  if (!changed) return;
  const registrants = await listEventRegistrantIds(after.id);
  await Promise.all(registrants.map((userId) => notifyUser(userId, "event_changed", { title: after.title }, `/events?event=${encodeURIComponent(after.id)}`, actorId)));
}

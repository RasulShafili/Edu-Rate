import { randomUUID } from "node:crypto";
import webpush from "web-push";
import { env } from "../config/env.js";
import { databasePool } from "./database.js";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type StoredSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const memory = new Map<string, StoredSubscription>();

/** VAPID açarları yoxdursa push tamamilə passivdir — sayt normal işləyir. */
export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export function pushPublicKey() {
  return pushEnabled ? env.VAPID_PUBLIC_KEY! : null;
}

export async function saveSubscription(userId: string, input: PushSubscriptionInput, userAgent = "") {
  if (!databasePool) {
    memory.set(input.endpoint, {
      id: randomUUID(),
      userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    });
    return;
  }
  await databasePool.query(
    `INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,user_agent)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth,
       user_agent=EXCLUDED.user_agent, last_used_at=NOW()`,
    [randomUUID(), userId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent.slice(0, 300)],
  );
}

export async function removeSubscription(userId: string, endpoint: string) {
  if (!databasePool) {
    const existing = memory.get(endpoint);
    if (existing?.userId === userId) memory.delete(endpoint);
    return;
  }
  await databasePool.query("DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2", [endpoint, userId]);
}

/** Hesab silinəndə: istifadəçinin bütün cihaz abunələri. */
export async function removeAllSubscriptions(userId: string) {
  if (!databasePool) {
    for (const [endpoint, item] of memory) if (item.userId === userId) memory.delete(endpoint);
    return;
  }
  await databasePool.query("DELETE FROM push_subscriptions WHERE user_id=$1", [userId]);
}

async function listSubscriptions(userIds?: string[]): Promise<StoredSubscription[]> {
  if (!databasePool) {
    const all = [...memory.values()];
    return userIds ? all.filter((item) => userIds.includes(item.userId)) : all;
  }
  const result = userIds
    ? await databasePool.query("SELECT * FROM push_subscriptions WHERE user_id=ANY($1::uuid[])", [userIds])
    : await databasePool.query("SELECT * FROM push_subscriptions");
  return result.rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    endpoint: String(row.endpoint),
    p256dh: String(row.p256dh),
    auth: String(row.auth),
  }));
}

async function dropDeadSubscription(endpoint: string) {
  if (!databasePool) {
    memory.delete(endpoint);
    return;
  }
  await databasePool.query("DELETE FROM push_subscriptions WHERE endpoint=$1", [endpoint]);
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Bildirişi göndərir. Açar yoxdursa səssiz keçir; abunə etibarsızdırsa
 * (404/410) bazadan silinir. Heç bir halda çağıran axını pozmur.
 */
export async function sendPush(message: PushMessage, userIds?: string[]) {
  if (!pushEnabled) return { sent: 0, skipped: true };
  const subscriptions = await listSubscriptions(userIds);
  const payload = JSON.stringify(message);
  let sent = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await dropDeadSubscription(subscription.endpoint);
    }
  }));

  return { sent, skipped: false };
}

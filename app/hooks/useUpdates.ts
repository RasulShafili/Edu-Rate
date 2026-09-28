"use client";

import { useEffect } from "react";
import useSWR from "swr";

export type NotificationItem = {
  id: string;
  kind: string;
  params: Record<string, string>;
  url: string;
  readAt: string | null;
  createdAt: string;
};
export type DirectPeer = { id: string; name: string; role: string; program: string; city: string; avatarUrl?: string };
export type UnreadConversation =
  | { kind: "direct"; id: string; name: string; unreadCount: number; peer: DirectPeer }
  | { kind: "group"; id: string; name: string; unreadCount: number; group: { clubId: string; memberCount: number; isAdmin: boolean } };
export type IncomingConnection = { id: string; name: string };
export type Updates = {
  notifications: NotificationItem[];
  unreadNotifications: number;
  conversations: UnreadConversation[];
  connections: IncomingConnection[];
  /** Zəngdəki nöqtə/say: oxunmamış bildiriş + gözləyən sorğu + oxunmamış söhbət. */
  total: number;
};

/** Bu hadisələrdən biri gələndə zəng və panel yenidən yüklənir. */
export const UPDATES_EVENTS = ["edurate:notifications-changed", "edurate:connections-changed", "edurate:chat-changed"] as const;
export function announceUpdates(event: (typeof UPDATES_EVENTS)[number] = "edurate:notifications-changed") {
  window.dispatchEvent(new CustomEvent(event));
}

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;
  return ((await response.json().catch(() => null)) as { data?: T } | null)?.data ?? null;
}

async function loadUpdates(userId: string): Promise<Updates> {
  const [notificationsResponse, connectionsResponse, conversationsResponse, groupsResponse] = await Promise.all([
    fetch("/api/notifications", { cache: "no-store" }),
    fetch("/api/community/connections", { cache: "no-store" }),
    fetch("/api/community/conversations", { cache: "no-store" }),
    fetch("/api/community/groups", { cache: "no-store" }),
  ]);
  // Hamısı uğursuzdursa (məs. backend yatıb) boş siyahı yox, xəta — SWR köhnə məlumatı saxlayır.
  if (![notificationsResponse, connectionsResponse, conversationsResponse, groupsResponse].some((response) => response.ok)) {
    throw new Error("updates-unavailable");
  }
  const [notifications, connections, conversations, groups] = await Promise.all([
    readJson<{ items: NotificationItem[]; unread: number }>(notificationsResponse),
    readJson<Array<{ id: string; requesterId: string; recipientId: string; status: string }>>(connectionsResponse),
    readJson<Array<{ id: string; peer: DirectPeer; unreadCount: number; muted: boolean }>>(conversationsResponse),
    readJson<Array<{ id: string; club: { id: string; name: string }; memberCount: number; isAdmin: boolean; unreadCount: number; muted: boolean }>>(groupsResponse),
  ]);
  const pending = (connections ?? []).filter((entry) => entry.status === "pending" && entry.recipientId === userId);
  let names = new Map<string, string>();
  if (pending.length) {
    const users = await readJson<Array<{ id: string; name: string }>>(await fetch("/api/community/users", { cache: "no-store" }));
    names = new Map((users ?? []).map((entry) => [entry.id, entry.name]));
  }
  // Səssizə alınmış söhbətlər bildiriş sayılmır.
  const unreadConversations: UnreadConversation[] = [
    ...(conversations ?? []).filter((entry) => entry.unreadCount > 0 && !entry.muted)
      .map((entry) => ({ kind: "direct" as const, id: entry.id, name: entry.peer.name, unreadCount: entry.unreadCount, peer: entry.peer })),
    ...(groups ?? []).filter((entry) => entry.unreadCount > 0 && !entry.muted)
      .map((entry) => ({ kind: "group" as const, id: entry.id, name: entry.club.name, unreadCount: entry.unreadCount, group: { clubId: entry.club.id, memberCount: entry.memberCount, isAdmin: entry.isAdmin } })),
  ];
  const incoming = pending.map((entry) => ({ id: entry.id, name: names.get(entry.requesterId) ?? "" }));
  const unreadNotifications = notifications?.unread ?? 0;
  return {
    notifications: notifications?.items ?? [],
    unreadNotifications,
    conversations: unreadConversations,
    connections: incoming,
    total: unreadNotifications + incoming.length + unreadConversations.length,
  };
}

/**
 * Zəng (başlıq) və "Yeniliklər" paneli üçün ortaq məlumat. Eyni SWR açarı
 * sayəsində hər ikisi bir sorğu ilə yenilənir və bir-biri ilə uyğun qalır.
 */
export function useUpdates(userId: string | undefined) {
  const swr = useSWR(userId ? ["updates", userId] : null, ([, id]: [string, string]) => loadUpdates(id), {
    dedupingInterval: 5_000,
    refreshInterval: 60_000,
    keepPreviousData: true,
  });
  const { mutate } = swr;
  useEffect(() => {
    const refresh = () => void mutate();
    for (const event of UPDATES_EVENTS) window.addEventListener(event, refresh);
    return () => { for (const event of UPDATES_EVENTS) window.removeEventListener(event, refresh); };
  }, [mutate]);
  return swr;
}

"use client";

import { RefreshCw } from "lucide-react";
import useSWR from "swr";
import type { AnnouncementItem, StudentFeedItem } from "../data/network";
import { StudentFeed } from "./StudentFeed";
import { useT } from "../i18n/LanguageProvider";

type NetworkPayload = {
  announcements: AnnouncementItem[];
  items: StudentFeedItem[];
};

async function loadNetwork(fallbackMessage: string): Promise<NetworkPayload> {
  const response = await fetch("/api/network", { headers: { Accept: "application/json" } });
  const payload = await response.json() as { data?: NetworkPayload; error?: { message?: string } };
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? fallbackMessage);
  return payload.data;
}

export function StudentFeedRemote() {
  const t = useT();
  const { data, error, isLoading, isValidating, mutate } = useSWR("student-network", () => loadNetwork(t("feed.loadFailed")), {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  if (isLoading) {
    return (
      <section className="feed-remote-state" aria-label={t("feed.remoteLoading")} aria-busy="true">
        <div><i /><i /><i /></div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="feed-remote-state is-error" role="alert">
        <h1>{t("feed.remoteErrorTitle")}</h1>
        <p>{t("feed.remoteErrorBody")}</p>
        <button type="button" onClick={() => void mutate()}><RefreshCw size={16} /> {t("feed.retry")}</button>
      </section>
    );
  }

  return (
    <div aria-busy={isValidating}>
      <StudentFeed announcements={data.announcements} items={data.items} />
    </div>
  );
}

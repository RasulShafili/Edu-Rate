"use client";

import { Bell, ChevronRight, LoaderCircle, LogIn, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useEffect, useSyncExternalStore } from "react";
import useSWR from "swr";
import { getPlatformRouteContext } from "../data/platform-shell";
import { useCurrentAvatar } from "../lib/current-avatar";
import type { CSSProperties } from "react";
import { routeLabelKeys } from "../i18n/config";
import { useT } from "../i18n/LanguageProvider";

type PlatformHeaderProps = {
  searchOpen: boolean;
  updatesOpen: boolean;
  onSearchToggle: () => void;
  onUpdatesToggle: () => void;
};

export function PlatformHeader({ searchOpen, updatesOpen, onSearchToggle, onUpdatesToggle }: PlatformHeaderProps) {
  const t = useT();
  const pathname = usePathname();
  const { user, sessionPending } = useAuth();
  const avatar = useCurrentAvatar(user?.id);
  // Zəngdəki nöqtə əvvəl şərtsiz çəkilirdi — panel "yeni bildiriş yoxdur" desə də
  // həmişə "yenilik var" göstərirdi. İndi yalnız gözləyən əlaqə sorğusu və ya
  // oxunmamış söhbət olanda görünür (panelin "Sənə gələnlər" siyahısı ilə eyni qayda).
  const updates = useSWR(user ? ["header-updates", user.id] : null, async ([, userId]: [string, string]) => {
    const [connections, conversations] = await Promise.all([
      fetch("/api/community/connections", { cache: "no-store" }),
      fetch("/api/community/conversations", { cache: "no-store" }),
    ]);
    if (!connections.ok || !conversations.ok) return false;
    const connectionList = ((await connections.json()) as { data?: Array<{ status: string; recipientId: string }> }).data ?? [];
    const conversationList = ((await conversations.json()) as { data?: Array<{ unreadCount: number }> }).data ?? [];
    return connectionList.some((entry) => entry.status === "pending" && entry.recipientId === userId)
      || conversationList.some((entry) => entry.unreadCount > 0);
  }, { dedupingInterval: 30_000, refreshInterval: 60_000 });
  const refreshUpdates = updates.mutate;
  useEffect(() => {
    const refresh = () => void refreshUpdates();
    window.addEventListener("edurate:connections-changed", refresh);
    return () => window.removeEventListener("edurate:connections-changed", refresh);
  }, [refreshUpdates]);
  const context = getPlatformRouteContext(pathname);
  const shortcutLabel = useSyncExternalStore(
    () => () => undefined,
    () => /mac|iphone|ipad/i.test(`${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`) ? "⌘ K" : "Ctrl K",
    () => "Ctrl K",
  );

  return (
    <header className="platform-header" aria-label={t("nav.home")}>
      <div className="platform-header-context">
        <div className="platform-breadcrumb" aria-label={t("shell.breadcrumb")}>
          <span>EduRate</span>
          <ChevronRight size={14} aria-hidden="true" />
          <strong>{t(routeLabelKeys[pathname] ?? context.labelKey)}</strong>
        </div>
      </div>

      <div className="platform-header-actions">
        <button
          type="button"
          className="platform-header-search"
          onClick={onSearchToggle}
          aria-expanded={searchOpen}
          aria-controls="platform-desktop-utility-panel"
        >
          <Search size={17} aria-hidden="true" />
          <span>{t("common.search")}</span>
          <kbd aria-hidden="true">{shortcutLabel}</kbd>
        </button>
        <button
          type="button"
          className="platform-header-icon"
          onClick={onUpdatesToggle}
          aria-label={t("shell.notificationsOpen")}
          aria-expanded={updatesOpen}
          aria-controls="platform-desktop-utility-panel"
          title={t("shell.notifications")}
        >
          <Bell size={18} aria-hidden="true" />
          {updates.data ? <i aria-hidden="true" /> : null}
        </button>
        <Link
          href={user ? "/profile" : "/auth"}
          className="platform-header-account"
          aria-label={t(user || sessionPending ? "header.profile" : "header.signIn")}
          aria-busy={!user && sessionPending ? true : undefined}
        >
          {user ? (
            <span
              className={avatar.data?.secureUrl ? "has-image" : undefined}
            >
              {avatar.data?.secureUrl ? (
                <i
                  className="platform-header-avatar-photo"
                  style={{ backgroundImage: `url("${avatar.data.secureUrl}")` } as CSSProperties}
                />
              ) : user.initials}
            </span>
          ) : sessionPending ? (
            <LoaderCircle size={18} aria-hidden="true" className="is-spinning" />
          ) : (
            <LogIn size={18} aria-hidden="true" />
          )}
          <small>{user ? user.name : sessionPending ? t("session.waking.eyebrow") : t("nav.signIn")}</small>
        </Link>
      </div>
    </header>
  );
}

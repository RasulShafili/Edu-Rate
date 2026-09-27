"use client";

import { Bell, ChevronRight, LogIn, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useSyncExternalStore } from "react";
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
  const { user } = useAuth();
  const avatar = useCurrentAvatar(user?.id);
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
          <i aria-hidden="true" />
        </button>
        <Link
          href={user ? "/profile" : "/auth"}
          className="platform-header-account"
          aria-label={user ? "Profilim" : "Hesaba daxil ol"}
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
          ) : (
            <LogIn size={18} aria-hidden="true" />
          )}
          <small>{user ? user.name : t("nav.signIn")}</small>
        </Link>
      </div>
    </header>
  );
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  Command,
  MessageCircle,
  Search,
  Sparkles,
  UserX,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { bakuDateParts } from "../lib/date";
import {
  getPlatformRouteContext,
  platformSearchItems,
  platformSectionCount,
  type PlatformRouteContext,
} from "../data/platform-shell";
import { useAuth } from "./AuthProvider";
import { useT } from "../i18n/LanguageProvider";
import { usePlatform } from "./PlatformProvider";
import { roleLabelKey } from "./PeerDirectory";
import { announceUpdates, useUpdates, type NotificationItem, type UnreadConversation } from "../hooks/useUpdates";

export type UtilityTab = "search" | "shortcuts" | "updates";

type PlatformUtilityRailProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  desktopOpen: boolean;
  onDesktopOpenChange: (open: boolean) => void;
  requestedTab: UtilityTab;
};

type UtilityContentProps = {
  activeTab: UtilityTab;
  context: PlatformRouteContext;
  query: string;
  onQueryChange: (value: string) => void;
  onNavigate: () => void;
  onSearchSubmit: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  idPrefix: string;
};

const utilityTabs: readonly {
  id: UtilityTab;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { id: "search", labelKey: "rail.tab.search", icon: Search },
  { id: "shortcuts", labelKey: "rail.tab.shortcuts", icon: Command },
  { id: "updates", labelKey: "rail.tab.updates", icon: Bell },
];

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("az");
}

/**
 * Axtarış tərcümə olunmuş ad və təsvirdə də aparılır — əvvəl yalnız
 * azərbaycanca mətnə baxırdı, EN/RU istifadəçisi "events" yazanda heç nə tapmırdı.
 */
function searchPlatform(query: string, t: (key: string) => string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return platformSearchItems.slice(0, 6);
  return platformSearchItems.filter((item) =>
    normalizeSearchValue(`${t(`rail.search.${item.key}`)} ${t(`rail.search.${item.key}.desc`)} ${item.keywords}`).includes(normalizedQuery),
  );
}

/** Bildirişin mətni: parametrlər (status kimi) seçilmiş dilə çevrilir. */
function notificationText(item: NotificationItem, t: (key: string, values?: Record<string, string | number>) => string) {
  const params = { ...item.params, ...(item.params.status ? { status: t(`notif.status.${item.params.status}`) } : {}) };
  const key = `notif.${item.kind}`;
  const text = t(key, params);
  return text === key ? t("notif.generic") : text;
}

/** Bu gün üçün saat, əvvəlki günlər üçün "5 okt" (Bakı vaxtı). */
function notificationTime(value: string, t: (key: string) => string) {
  const parts = bakuDateParts(value);
  const today = bakuDateParts(new Date().toISOString());
  if (parts.day === today.day && parts.month === today.month && parts.year === today.year) return parts.time;
  return `${Number(parts.day)} ${t(`monthShort.${parts.month}`)}`;
}

/** Tarix Bakı vaxtı ilə: "5 okt" və "18:30". */
function shortBakuDate(value: string, t: (key: string) => string) {
  const parts = bakuDateParts(value);
  return { day: String(Number(parts.day)), month: t(`monthShort.${parts.month}`), time: parts.time };
}

function UtilityContent({
  activeTab,
  context,
  query,
  onQueryChange,
  onNavigate,
  onSearchSubmit,
  searchInputRef,
  idPrefix,
}: UtilityContentProps) {
  const t = useT();
  const { user } = useAuth();
  const [upcomingEvents,setUpcomingEvents]=useState<Array<{id:string;title:string;startAt:string;location:string}>>([]);
  const [activeAnnouncements,setActiveAnnouncements]=useState<Array<{id:string;title:string;startsAt:string;expiresAt?:string;source:string}>>([]);
  const updates = useUpdates(user?.id);
  const notifications = updates.data?.notifications ?? [];
  const unreadNotifications = updates.data?.unreadNotifications ?? 0;
  const incomingConnections = updates.data?.connections ?? [];
  const unreadConversations = updates.data?.conversations ?? [];
  const { openConversation, openClubConversation } = usePlatform();
  const router = useRouter();
  const [markingAll, setMarkingAll] = useState(false);
  const [connectionActionId,setConnectionActionId]=useState<string|null>(null);
  const [connectionActionError,setConnectionActionError]=useState("");
  useEffect(()=>{let cancelled=false;void Promise.all([fetch("/api/catalog/events",{cache:"no-store"}),fetch("/api/network",{cache:"no-store"})]).then(async([eventsResponse,networkResponse])=>{const eventsPayload=await eventsResponse.json() as {data?:Array<{id:string;title:string;startAt:string;location:string}>};const networkPayload=await networkResponse.json() as {data?:{announcements?:Array<{id:string;title:string;startsAt:string;expiresAt?:string;source:string}>}};if(!cancelled){setUpcomingEvents((eventsPayload.data??[]).filter((item)=>new Date(item.startAt).getTime()>=Date.now()).slice(0,3));/* Lövhə kimi: müddəti bitmiş elan "son elanlar"da göstərilmir. */setActiveAnnouncements((networkPayload.data?.announcements??[]).filter((item)=>!item.expiresAt||new Date(item.expiresAt).getTime()>Date.now()).slice(0,3));}}).catch(()=>undefined);return()=>{cancelled=true;};},[]);
  // Panel açılanda təzə vəziyyəti göstər (fonda 60 saniyədə bir də yenilənir).
  const refreshUpdates = updates.mutate;
  useEffect(() => { if (user && activeTab === "updates") void refreshUpdates(); }, [activeTab, refreshUpdates, user]);

  async function openNotification(item: NotificationItem) {
    onNavigate();
    if (!item.readAt) {
      void refreshUpdates((current) => current && ({
        ...current,
        notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry),
        unreadNotifications: Math.max(0, current.unreadNotifications - 1),
        total: Math.max(0, current.total - 1),
      }), { revalidate: false });
      void fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "PATCH" }).finally(() => announceUpdates());
    }
    router.push(item.url.startsWith("/") ? item.url : "/");
  }

  async function markAllRead() {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (response.ok) announceUpdates();
    } finally {
      setMarkingAll(false);
    }
  }

  /** Oxunmamış söhbət əvvəl sadəcə /community-yə aparırdı; indi həmin söhbəti açır. */
  function openUnreadConversation(conversation: UnreadConversation) {
    onNavigate();
    if (conversation.kind === "group") {
      openClubConversation({ conversationId: conversation.id, clubId: conversation.group.clubId, name: conversation.name, initials: conversation.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""), memberCount: conversation.group.memberCount, isAdmin: conversation.group.isAdmin });
      return;
    }
    const peer = conversation.peer;
    openConversation({ id: peer.id, name: peer.name, initials: peer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""), role: roleLabelKey(peer.role), focus: peer.program, bio: "", city: peer.city, status: "online", accent: "#8fc15f", glow: "rgba(143,193,95,.28)", mutuals: 0, tags: [], openingMessage: "", reply: "", avatarUrl: peer.avatarUrl });
  }

  async function decideConnection(connectionId: string, decision: "accept" | "reject") {
    if (connectionActionId) return;
    setConnectionActionId(connectionId);
    setConnectionActionError("");
    try {
      const response = await fetch(`/api/community/connections/${connectionId}`, {
        method: decision === "accept" ? "PATCH" : "DELETE",
        headers: decision === "accept" ? { "content-type": "application/json" } : undefined,
        body: decision === "accept" ? JSON.stringify({}) : undefined,
      });
      if (!response.ok) {
        // Mətn yox, açar: backend-in azərbaycanca mesajı EN/RU-da da görünürdü.
        throw new Error(response.status === 401 ? "admin.error.session" : "rail.connectionFailed");
      }
      void refreshUpdates((current) => current && ({ ...current, connections: current.connections.filter((item) => item.id !== connectionId), total: Math.max(0, current.total - 1) }), { revalidate: false });
      window.dispatchEvent(new CustomEvent("edurate:connections-changed"));
    } catch (error) {
      setConnectionActionError(error instanceof Error && error.message === "admin.error.session" ? error.message : "rail.connectionFailed");
    } finally {
      setConnectionActionId(null);
    }
  }
  const filteredItems = useMemo(() => searchPlatform(query, t), [query, t]);

  if (activeTab === "search") {
    return (
      <div id={`${idPrefix}-search`} className="platform-utility-content" role="tabpanel" aria-label={t("common.search")}>
        <form
          className="platform-global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
        >
          <Search size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor={`${idPrefix}-search-input`}>{t("common.search")}</label>
          <input
            ref={searchInputRef}
            id={`${idPrefix}-search-input`}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("rail.searchPlaceholder")}
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown") return;
              const firstResult = event.currentTarget.closest(".platform-utility-content")?.querySelector<HTMLElement>(".platform-search-results a");
              if (firstResult) { event.preventDefault(); firstResult.focus(); }
            }}
          />
          <kbd aria-hidden="true">↵</kbd>
        </form>

        <div className="platform-search-summary" aria-live="polite">
          <span>{t(query ? "rail.searchResults" : "rail.quickLinks")}</span>
          <strong>{filteredItems.length}</strong>
        </div>

        <div
          className="platform-search-results"
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a"));
            const index = links.indexOf(document.activeElement as HTMLElement);
            if (index < 0) return;
            event.preventDefault();
            const next = event.key === "ArrowDown" ? Math.min(index + 1, links.length - 1) : Math.max(index - 1, 0);
            links[next]?.focus();
          }}
        >
          {filteredItems.length > 0 ? filteredItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <span>
                <strong>{t(`rail.search.${item.key}`)}</strong>
                <small>{t(`rail.search.${item.key}.desc`)}</small>
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )) : (
            <p className="platform-search-empty">{t("rail.searchEmpty")}</p>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === "shortcuts") {
    return (
      <div id={`${idPrefix}-shortcuts`} className="platform-utility-content" role="tabpanel" aria-label={t("rail.shortcutsLabel")}>
        <div className="platform-context-card">
          <span>{t(context.labelKey)}</span>
          <h3>{t(`rail.ctx.${context.key}.title`)}</h3>
          <small><i aria-hidden="true" />{t(`rail.ctx.${context.key}.metric`, { count: platformSectionCount })}</small>
        </div>

        <div className="platform-shortcut-list">
          {context.shortcuts.map((shortcut) => (
            <Link key={shortcut.href} href={shortcut.href} onClick={onNavigate}>
              <span>
                <strong>{t(`rail.sc.${shortcut.key}`)}</strong>
                <small>{t(`rail.sc.${shortcut.key}.desc`)}</small>
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id={`${idPrefix}-updates`} className="platform-utility-content" role="tabpanel" aria-label={t("rail.tab.updates")}>
      <section className="platform-update-group" aria-labelledby={`${idPrefix}-notifications-title`}>
        <header>
          <Bell size={15} aria-hidden="true" />
          <h3 id={`${idPrefix}-notifications-title`}>{t("rail.forYou")}</h3>
          {unreadNotifications ? (
            <button type="button" className="platform-mark-all" onClick={() => void markAllRead()} disabled={markingAll}>
              <CheckCheck size={13} aria-hidden="true" /> {t("rail.markAllRead")}
            </button>
          ) : null}
        </header>
        {!user ? (
          <Link href="/auth" onClick={onNavigate}>
            <span className="platform-update-dot" aria-hidden="true" />
            <span><strong>{t("rail.signInForUpdates")}</strong><small>{t("rail.signInForUpdatesHint")}</small></span>
          </Link>
        ) : updates.error && !updates.data ? (
          <p className="platform-search-empty" role="alert">{t("rail.updatesFailed")}</p>
        ) : !updates.data ? (
          <p className="platform-search-empty" role="status">{t("rail.updatesLoading")}</p>
        ) : notifications.length || incomingConnections.length || unreadConversations.length ? (
          <>
            {incomingConnections.map((connection) => (
              <article key={connection.id} className="platform-connection-request">
                <span className="platform-update-dot" aria-hidden="true" />
                <span><strong>{connection.name || t("rail.someone")}</strong><small>{t("rail.connectionRequest")}</small></span>
                <div className="platform-connection-actions">
                  <button
                    type="button"
                    className="is-accept"
                    onClick={() => void decideConnection(connection.id, "accept")}
                    disabled={connectionActionId === connection.id}
                  >
                    <Check size={13} aria-hidden="true" /> {t("rail.accept")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideConnection(connection.id, "reject")}
                    disabled={connectionActionId === connection.id}
                  >
                    <UserX size={13} aria-hidden="true" /> {t("rail.reject")}
                  </button>
                </div>
              </article>
            ))}
            {unreadConversations.map((conversation) => (
              <button key={conversation.id} type="button" className="platform-notification-item is-unread" onClick={() => openUnreadConversation(conversation)}>
                <span className="platform-notification-icon" aria-hidden="true"><MessageCircle size={14} /></span>
                <span><strong>{t("rail.newMessage", { name: conversation.name })}</strong><small>{t("rail.unread", { count: conversation.unreadCount })}</small></span>
              </button>
            ))}
            {notifications.map((item) => (
              <button key={item.id} type="button" className={`platform-notification-item${item.readAt ? "" : " is-unread"}`} onClick={() => void openNotification(item)}>
                <span className="platform-notification-icon" aria-hidden="true"><Bell size={14} /></span>
                <span><strong>{notificationText(item, t)}</strong><small>{notificationTime(item.createdAt, t)}</small></span>
                {item.readAt ? null : <i className="sr-only">{t("rail.unreadLabel")}</i>}
              </button>
            ))}
          </>
        ) : (
          <p className="platform-search-empty">{t("rail.noUpdates")}</p>
        )}
        {connectionActionError ? <p className="platform-connection-error" role="alert">{t(connectionActionError)}</p> : null}
      </section>
      <section className="platform-update-group" aria-labelledby={`${idPrefix}-events-title`}>
        <header>
          <CalendarDays size={15} aria-hidden="true" />
          <h3 id={`${idPrefix}-events-title`}>{t("rail.upcomingEvents")}</h3>
        </header>
        {upcomingEvents.map((event) => {
          // Əvvəl gün brauzerin saat qurşağı, ay isə UTC ISO sətrindən götürülürdü
          // və "ay" yerinə bütün tarix ("5 oktyabr 2026") yazılırdı.
          const date = shortBakuDate(event.startAt, t);
          return (
            <Link key={event.id} href="/events" onClick={onNavigate}>
              <time dateTime={event.startAt}><strong>{date.day}</strong>{date.month}</time>
              <span><strong>{event.title}</strong><small>{date.time} · {event.location}</small></span>
            </Link>
          );
        })}
        {upcomingEvents.length === 0 ? <p className="platform-search-empty">{t("rail.noEvents")}</p> : null}
      </section>

      <section className="platform-update-group" aria-labelledby={`${idPrefix}-announcements-title`}>
        <header>
          <Sparkles size={15} aria-hidden="true" />
          <h3 id={`${idPrefix}-announcements-title`}>{t("rail.latestAnnouncements")}</h3>
        </header>
        {activeAnnouncements.map((announcement) => (
          <Link key={announcement.id} href="/feed" onClick={onNavigate}>
            <span className="platform-update-dot" aria-hidden="true" />
            <span><strong>{announcement.title}</strong><small>{(() => { const date = shortBakuDate(announcement.startsAt, t); return `${date.day} ${date.month}`; })()} · {announcement.source}</small></span>
          </Link>
        ))}
        {activeAnnouncements.length === 0 ? <p className="platform-search-empty">{t("rail.noAnnouncements")}</p> : null}
      </section>
    </div>
  );
}

export function PlatformUtilityRail({
  mobileOpen,
  onMobileClose,
  desktopOpen,
  onDesktopOpenChange,
  requestedTab,
}: PlatformUtilityRailProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<UtilityTab | null>(null);
  const [query, setQuery] = useState("");
  const lastDesktopTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const context = getPlatformRouteContext(pathname);
  const displayedMobileTab = activeTab ?? requestedTab;
  const displayedDesktopTab = desktopOpen ? activeTab ?? requestedTab : null;

  const closeDesktopPanel = useCallback((restoreFocus = true) => {
    const fallbackTrigger = document.querySelector<HTMLElement>(
      '[aria-controls="platform-desktop-utility-panel"][aria-expanded="true"]',
    );
    setActiveTab(null);
    onDesktopOpenChange(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        (lastDesktopTriggerRef.current ?? fallbackTrigger)?.focus();
      });
    }
  }, [onDesktopOpenChange]);

  const closeAllPanels = useCallback(() => {
    closeDesktopPanel(false);
    onMobileClose();
  }, [closeDesktopPanel, onMobileClose]);

  const firstSearchResult = useMemo(() => searchPlatform(query, t)[0], [query, t]);

  useEffect(() => {
    const visibleTab = activeTab ?? (mobileOpen || desktopOpen ? "search" : null);
    if (visibleTab !== "search") return;
    const frame = window.requestAnimationFrame(() => {
      (mobileOpen ? mobileSearchRef : desktopSearchRef).current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, desktopOpen, mobileOpen]);

  useEffect(() => {
    if (!desktopOpen || mobileOpen) return;

    function handlePanelKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDesktopPanel();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = document.getElementById("platform-desktop-utility-panel");
      const focusable = Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    window.addEventListener("keydown", handlePanelKeyboard);
    return () => window.removeEventListener("keydown", handlePanelKeyboard);
  }, [closeDesktopPanel, desktopOpen, mobileOpen]);

  function toggleDesktopTab(tab: UtilityTab, trigger: HTMLButtonElement) {
    lastDesktopTriggerRef.current = trigger;
    setActiveTab((current) => {
      const next = (current ?? requestedTab) === tab ? null : tab;
      onDesktopOpenChange(Boolean(next));
      return next;
    });
  }

  function submitSearch() {
    if (!firstSearchResult) return;
    router.push(firstSearchResult.href);
    closeAllPanels();
  }

  return (
    <>
      <aside className="platform-right-rail" aria-label={t("rail.pageTools")}>
        <span className="platform-rail-status" aria-label={t("rail.currentSection", { section: t(context.labelKey) })}>{t(context.labelKey).slice(0, 1)}</span>
        <div role="tablist" aria-label={t("rail.globalTools")}>
          {utilityTabs.map((tab) => {
            const Icon = tab.icon;
            const selected = displayedDesktopTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`platform-utility-tab${selected ? " is-active" : ""}`}
                onClick={(event) => toggleDesktopTab(tab.id, event.currentTarget)}
                aria-label={t(tab.labelKey)}
                aria-selected={selected}
                aria-expanded={selected}
                aria-controls="platform-desktop-utility-panel"
                role="tab"
                data-label={t(tab.labelKey)}
              >
                <Icon size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </aside>

      <AnimatePresence>
        {displayedDesktopTab && !mobileOpen && (
          <motion.aside
            id="platform-desktop-utility-panel"
            className="platform-utility-panel"
            initial={reducedMotion ? false : { opacity: 0, x: 24, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 18, scale: 0.99 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
            aria-label={t(utilityTabs.find((tab) => tab.id === displayedDesktopTab)?.labelKey ?? "rail.tab.search")}
          >
            <header className="platform-utility-panel-header">
              <div><span>{t("rail.pageTools")}</span><h2>{t(utilityTabs.find((tab) => tab.id === displayedDesktopTab)?.labelKey ?? "rail.tab.search")}</h2></div>
              <button type="button" onClick={() => closeDesktopPanel()} aria-label={t("rail.closePanel")}><X size={17} aria-hidden="true" /></button>
            </header>
            <UtilityContent
              activeTab={displayedDesktopTab}
              context={context}
              query={query}
              onQueryChange={setQuery}
              onNavigate={closeAllPanels}
              onSearchSubmit={submitSearch}
              searchInputRef={desktopSearchRef}
              idPrefix="desktop-utility"
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="platform-mobile-utility-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="platform-mobile-utility-backdrop" onClick={onMobileClose} aria-label={t("rail.closePanel")} />
            <motion.aside
              id="platform-mobile-utility-sheet"
              className="platform-mobile-utility-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={t("rail.pageTools")}
              initial={reducedMotion ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
            >
              <header className="platform-mobile-utility-header">
                <div><span>{t(context.labelKey)}</span><strong>{t("rail.pageTools")}</strong></div>
                <button type="button" onClick={onMobileClose} aria-label={t("rail.closePanel")}><X size={19} aria-hidden="true" /></button>
              </header>

              <div className="platform-mobile-utility-tabs" role="tablist" aria-label={t("rail.globalTools")}>
                {utilityTabs.map((tab) => {
                  const Icon = tab.icon;
                  const selected = displayedMobileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={selected ? "is-active" : ""}
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      aria-selected={selected}
                      aria-controls="platform-mobile-utility-content"
                    >
                      <Icon size={15} aria-hidden="true" />
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
              </div>

              <div id="platform-mobile-utility-content" className="platform-mobile-utility-scroll">
                <UtilityContent
                  activeTab={displayedMobileTab}
                  context={context}
                  query={query}
                  onQueryChange={setQuery}
                  onNavigate={closeAllPanels}
                  onSearchSubmit={submitSearch}
                  searchInputRef={mobileSearchRef}
                  idPrefix="mobile-utility"
                />
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

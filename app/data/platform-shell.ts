import { accountRoutes, platformRoutes } from "./navigation";

/**
 * Sağ panelin məzmunu. Mətn burada yox, lüğətdədir: `rail.ctx.<key>.*`,
 * `rail.sc.<key>` / `rail.sc.<key>.desc`, `rail.search.<key>`. Əvvəl hamısı
 * azərbaycanca yazılmışdı və EN/RU interfeysdə də azərbaycanca görünürdü.
 */
export type PlatformShortcut = {
  href: string;
  key: string;
};

export type PlatformRouteContext = {
  key: string;
  labelKey: string;
  shortcuts: readonly PlatformShortcut[];
};

const homeContext: PlatformRouteContext = {
  key: "home",
  labelKey: "nav.home",
  shortcuts: [
    { href: "/events", key: "discoverEvents" },
    { href: "/community", key: "openCommunity" },
    { href: "/teachers", key: "chooseTeacher" },
  ],
};

// Əvvəl `/schedule`, `/questions` və `/workspace` üçün kontekst yox idi — bu
// səhifələrdə panel "Ana səhifə" kontekstini göstərirdi.
const routeContexts: Record<string, PlatformRouteContext> = {
  "/schedule": {
    key: "schedule",
    labelKey: "nav.schedule",
    shortcuts: [
      { href: "/events", key: "discoverEvents" },
      { href: "/feed", key: "campusNews" },
    ],
  },
  "/events": {
    key: "events",
    labelKey: "nav.events",
    shortcuts: [
      { href: "/events#events", key: "eventCatalogue" },
      { href: "/feed", key: "campusNews" },
    ],
  },
  "/community": {
    key: "community",
    labelKey: "nav.community",
    shortcuts: [
      { href: "/community#peers", key: "communityDirectory" },
      { href: "/clubs", key: "browseClubs" },
    ],
  },
  "/teachers": {
    key: "teachers",
    labelKey: "nav.teachers",
    shortcuts: [
      { href: "/teachers#available-teachers-track", key: "compareTeachers" },
      { href: "/teachers#teacher-rating-panel", key: "ratingPanel" },
    ],
  },
  "/mentors": {
    key: "mentors",
    labelKey: "nav.mentors",
    shortcuts: [
      { href: "/mentors#mentors", key: "findMentors" },
      { href: "/support", key: "contactSupport" },
    ],
  },
  "/questions": {
    key: "questions",
    labelKey: "nav.questions",
    shortcuts: [
      { href: "/mentors", key: "findMentors" },
      { href: "/support", key: "contactSupport" },
    ],
  },
  "/support": {
    key: "support",
    labelKey: "nav.support",
    shortcuts: [
      { href: "/support#support", key: "faq" },
      // `#ticket-name` yalnız anonim formada var idi; mövzu sahəsi hər iki halda var.
      { href: "/support#ticket-topic", key: "sendRequest" },
    ],
  },
  "/feed": {
    key: "feed",
    labelKey: "nav.feed",
    shortcuts: [
      { href: "/feed#announcements-title", key: "importantAnnouncements" },
      { href: "/feed#student-feed-stream-title", key: "studentNews" },
    ],
  },
  "/clubs": {
    key: "clubs",
    labelKey: "nav.clubs",
    shortcuts: [
      { href: "/clubs#clubs-list-title", key: "clubCatalogue" },
    ],
  },
  "/admin": {
    key: "admin",
    labelKey: "nav.admin",
    shortcuts: [
      { href: "/admin#admin-overview", key: "adminOverview" },
      { href: "/admin#admin-data", key: "adminData" },
    ],
  },
  "/profile": {
    key: "profile",
    labelKey: "nav.profile",
    shortcuts: [
      { href: "/profile#profile-title", key: "profileSummary" },
      { href: "/support", key: "accountSupport" },
    ],
  },
  "/workspace": {
    key: "workspace",
    labelKey: "nav.workspace",
    shortcuts: [
      { href: "/workspace#workspace-title", key: "workspaceOverview" },
      { href: "/profile", key: "profileSummary" },
    ],
  },
  "/settings": {
    key: "settings",
    labelKey: "nav.settings",
    shortcuts: [
      { href: "/settings#settings-title", key: "notificationSettings" },
      { href: "/privacy", key: "privacy" },
    ],
  },
  "/privacy": {
    key: "privacy",
    labelKey: "rail.label.privacy",
    shortcuts: [],
  },
  "/terms": {
    key: "terms",
    labelKey: "rail.label.terms",
    shortcuts: [],
  },
  "/cookies": {
    key: "cookies",
    labelKey: "rail.label.cookies",
    shortcuts: [],
  },
  "/community-guidelines": {
    key: "guidelines",
    labelKey: "rail.label.guidelines",
    shortcuts: [],
  },
  "/auth": {
    key: "auth",
    labelKey: "nav.signIn",
    shortcuts: [
      { href: "/auth#auth-title", key: "signInPanel" },
      { href: "/support", key: "signInSupport" },
    ],
  },
};

const searchKeyByHref: Record<string, string> = {
  "/": "home",
  "/schedule": "schedule",
  "/events": "events",
  "/community": "community",
  "/teachers": "teachers",
  "/mentors": "mentors",
  "/questions": "questions",
  "/support": "support",
  "/feed": "feed",
  "/clubs": "clubs",
  "/profile": "profile",
  "/workspace": "workspace",
  "/settings": "settings",
  "/auth": "auth",
};

/**
 * Axtarış bəndləri. `keywords` azərbaycanca saxlanır ki, AZ açar sözlərlə də
 * tapılsın; tərcümə olunmuş ad və təsvir axtarışa paneldə əlavə olunur.
 */
export const platformSearchItems = [
  { href: "/", keywords: "ana panel başlanğıc platforma" },
  ...platformRoutes.map((route) => ({
    href: route.href,
    keywords: `${route.label} ${route.title} ${route.description}`,
  })),
  ...accountRoutes.map((route) => ({
    href: route.href,
    keywords: route.href === "/profile"
      ? "profil hesab məlumat"
      : route.href === "/settings"
        ? "parametrlər bildiriş seçim"
        : route.href === "/workspace"
          ? "iş paneli müəllim mentor"
          : "daxil ol qeydiyyat hesab",
  })),
].map((item) => ({ ...item, key: searchKeyByHref[item.href] ?? "home" }));

export function isPlatformRouteCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPlatformRouteContext(pathname: string): PlatformRouteContext {
  if (pathname === "/") return homeContext;

  const matchingPath = Object.keys(routeContexts)
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));

  return matchingPath ? routeContexts[matchingPath] : homeContext;
}

export const platformSectionCount = platformRoutes.length;

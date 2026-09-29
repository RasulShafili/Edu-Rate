"use client";

import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  LifeBuoy,
  Megaphone,
  MapPin,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useAuth } from "./AuthProvider";
import { useLanguage } from "../i18n/LanguageProvider";
import { bakuDateParts, isExpired } from "../lib/date";

/**
 * Ana səhifə — sıx idarə paneli.
 *
 * Əvvəl burada ekranı tamamilə dolduran nəhəng başlıq, orbital animasiya və yan
 * menyunu təkrarlayan 7 kart var idi: real məlumat sıfır, boşluq maksimum.
 * İndi istifadəçi bir ekranda əsl məzmunu görür — son elanlar, yaxınlaşan
 * tədbirlər və populyar klublar. Bloklar sıx, kartlar kiçik, animasiya yoxdur.
 */

const quickLinks = [
  { href: "/events", label: "nav.events", icon: CalendarDays },
  { href: "/feed", label: "nav.feed", icon: Megaphone },
  { href: "/clubs", label: "nav.clubs", icon: Sparkles },
  { href: "/community", label: "nav.community", icon: UsersRound },
  { href: "/teachers", label: "nav.teachers", icon: GraduationCap },
  { href: "/mentors", label: "nav.mentors", icon: HeartHandshake },
  { href: "/support", label: "nav.support", icon: LifeBuoy },
] as const;

type Club = {
  id: string;
  slug: string;
  name: string;
  category?: string;
  memberCount?: number;
  visualMark?: string;
};

type Announcement = {
  id: string;
  category?: string;
  title: string;
  summary?: string;
  dateLabel?: string;
  source?: string;
  sourceInitials?: string;
  expiresAt?: string;
};

type CampusEvent = {
  id: string;
  title?: string;
  name?: string;
  startAt?: string;
  endAt?: string;
  place?: string;
  location?: string;
  category?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = (await response.json().catch(() => null)) as { data?: T } | null;
  if (!response.ok || !payload || payload.data === undefined) {
    throw new Error("Məlumat yüklənmədi.");
  }
  return payload.data;
}

/** "22 May" formatı — tarix seçilmiş dilin lokalında yazılır. */
/**
 * Tədbir vaxtı həmişə Bakı vaxtında: əvvəl brauzerin saat qurşağı işlənirdi və
 * cihazı UTC-də olan istifadəçi ana səhifədə 17:00, tədbir səhifəsində 21:00
 * görürdü. Ay adı lüğətdəndir — `Intl` bəzi Chromium qurğularında "M09" verir.
 */
function splitDate(value: string | undefined, t: (key: string) => string, locale: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  const parts = bakuDateParts(value);
  return {
    day: parts.day.padStart(2, "0"),
    month: t(`monthShort.${parts.month}`).toLocaleUpperCase(locale),
    time: parts.time,
  };
}

export function HomeExperience() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [openedAt] = useState(() => Date.now());
  // API "clubs"/"faculties" kimi açar qaytarır — seçilmiş dildə göstəririk.
  const categoryLabel = (value?: string) => (value ? t(`category.${value}`) : "");
  const firstName = user?.name.trim().split(/\s+/)[0];

  const clubs = useSWR("home-clubs", () => getJson<Club[]>("/api/clubs"), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const network = useSWR(
    "home-network",
    () => getJson<{ announcements: Announcement[] }>("/api/network"),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const events = useSWR("home-events", () => getJson<CampusEvent[]>("/api/catalog/events"), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  // Elanlar səhifəsi və bildiriş paneli yalnız aktiv elanları göstərir; ana səhifə
  // isə vaxtı keçmişləri də "Son elanlar" kimi verirdi (25 avqustda bağlanan
  // "müraciətlər açıqdır" sentyabrda da görünürdü). Arxiv "Hamısı" keçidindədir.
  const announcements = (network.data?.announcements ?? []).filter((item) => !item.expiresAt || !isExpired(item.expiresAt));
  const topClubs = [...(clubs.data ?? [])]
    .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))
    .slice(0, 4);
  // "Yaxınlaşan" — vaxtı keçməmiş tədbirlər (davam edənlər də daxil). Əvvəl süzgəc yox idi:
  // bitmiş tədbirlər (18, 22, 28 sentyabr) sentyabrın sonunda da "yaxınlaşan" görünürdü.
  const upcoming = (events.data ?? [])
    .filter((event) => {
      const end = new Date(event.endAt || event.startAt || "").getTime();
      return Number.isNaN(end) || end >= openedAt;
    })
    .slice(0, 4);

  return (
    <div className="home-board">
      {/* Kompakt banner — əvvəlki tam ekran hero-nun yerinə */}
      <section className="home-banner" aria-labelledby="home-title">
        <div>
          <span className="home-banner__kicker">
            <Sparkles size={13} aria-hidden="true" /> EduRate
          </span>
          <h1 id="home-title">
            {firstName ? t("home.welcome", { name: firstName }) : t("home.title")}
          </h1>
          <p>{t("home.subtitle")}</p>
        </div>
        <div className="home-banner__actions">
          <Link href="/events" className="home-btn is-primary">
            {t("home.ctaEvents")} <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href={user ? "/profile" : "/auth"} className="home-btn">
            {user ? t("home.ctaProfile") : t("nav.signIn")}
          </Link>
        </div>
      </section>

      <div className="home-columns">
        <div className="home-main">
          {/* Sürətli keçidlər — bir sıra, kiçik */}
          <nav className="home-quick" aria-label={t("home.quickLinks")}>
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="home-quick__item">
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(label)}</span>
              </Link>
            ))}
          </nav>

          <section className="home-panel" aria-labelledby="home-feed-title">
            <header className="home-panel__head">
              <h2 id="home-feed-title">{t("home.latestAnnouncements")}</h2>
              <Link href="/feed">{t("common.seeAll")} <ArrowRight size={14} aria-hidden="true" /></Link>
            </header>

            {network.isLoading ? (
              <ul className="home-skeleton" aria-hidden="true"><li /><li /><li /></ul>
            ) : announcements.length ? (
              <ul className="home-feed">
                {announcements.map((item) => (
                  <li key={item.id}>
                    <span className="home-feed__mark" aria-hidden="true">
                      {item.sourceInitials || item.title.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div className="home-feed__meta">
                        {item.category ? <em>{categoryLabel(item.category)}</em> : null}
                        {item.dateLabel ? <time>{item.dateLabel}</time> : null}
                      </div>
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty">{t("home.noAnnouncements")}</p>
            )}
          </section>
        </div>

        {/* Sağ sütun — tədbirlər və klublar */}
        <aside className="home-rail" aria-label={t("home.campusSummary")}>
          <section className="home-panel" aria-labelledby="home-events-title">
            <header className="home-panel__head">
              <h2 id="home-events-title">{t("home.upcomingEvents")}</h2>
              <Link href="/events" aria-label={t("home.allEvents")}>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </header>

            {events.isLoading ? (
              <ul className="home-skeleton" aria-hidden="true"><li /><li /></ul>
            ) : upcoming.length ? (
              <ul className="home-events">
                {upcoming.map((event) => {
                  const when = splitDate(event.startAt, t, locale);
                  return (
                    <li key={event.id}>
                      <span className="home-events__date" aria-hidden="true">
                        <strong>{when?.day ?? "--"}</strong>
                        <small>{when?.month ?? ""}</small>
                      </span>
                      <div>
                        <h3>{event.title ?? event.name ?? "Tədbir"}</h3>
                        <span className="home-events__meta">
                          <MapPin size={12} aria-hidden="true" />
                          {event.place ?? event.location ?? "Kampus"}
                          {when?.time ? ` · ${when.time}` : ""}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="home-empty">{t("home.noEvents")}</p>
            )}
          </section>

          <section className="home-panel" aria-labelledby="home-clubs-title">
            <header className="home-panel__head">
              <h2 id="home-clubs-title">{t("home.popularClubs")}</h2>
              <Link href="/clubs" aria-label={t("home.allClubs")}>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </header>

            {clubs.isLoading ? (
              <ul className="home-skeleton" aria-hidden="true"><li /><li /></ul>
            ) : topClubs.length ? (
              <ul className="home-clubs">
                {topClubs.map((club) => (
                  <li key={club.id}>
                    <span className="home-clubs__mark" aria-hidden="true">
                      {club.visualMark || club.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3>{club.name}</h3>
                      <small>
                        {t("home.clubMembers", { count: club.memberCount ?? 0 })}
                        {club.category ? ` · ${club.category}` : ""}
                      </small>
                    </div>
                    <Link href={`/clubs/${club.slug}`} className="home-clubs__cta">{t("common.view")}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="home-empty">{t("home.noClubs")}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

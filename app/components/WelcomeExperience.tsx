"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, Compass, GraduationCap, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/LanguageProvider";
import { bakuDateParts } from "../lib/date";
import { useAuth } from "./AuthProvider";

type Club = { slug: string; name: string; category: string; description?: string; tagline?: string };
type CampusEvent = { id: string; title: string; startAt: string; location?: string; category?: string };
type Teacher = { id: string; slug: string; name: string; specialty: string; headline: string };
/** Siyahının vəziyyəti: yüklənir / gəldi / alınmadı. */
type ListState = "loading" | "ready" | "failed";

export function WelcomeExperience() {
  const t = useT();
  const { user } = useAuth();
  const reduceMotion = Boolean(useReducedMotion());
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsState, setClubsState] = useState<ListState>("loading");
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [joined, setJoined] = useState<string[]>([]);
  const [pending, setPending] = useState("");
  const [joinError, setJoinError] = useState("");
  // Render zamanı Date.now() çağırmamaq üçün açılış anını bir dəfə sabitləyirik.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    /** Hər siyahı müstəqil gəlir: biri geciksə də qalanları dərhal görünür. */
    function loadInto<T>(path: string, apply: (items: T[]) => void, onState?: (state: ListState) => void) {
      void fetch(path, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(String(response.status));
          return (await response.json()) as { data?: T[] };
        })
        .then((payload) => {
          if (cancelled) return;
          apply(payload.data ?? []);
          onState?.("ready");
        })
        // Əvvəl xəta boş siyahıya çevrilirdi və "Klublar yüklənir…" həmişəlik qalırdı.
        .catch(() => { if (!cancelled) onState?.("failed"); });
    }

    loadInto<Club>("/api/clubs", setClubs, setClubsState);
    loadInto<CampusEvent>("/api/catalog/events", setEvents);
    loadInto<Teacher>("/api/catalog/teachers", setTeachers);

    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";
  const program = user?.program ?? "";

  const upcoming = useMemo(
    () => events
      .filter((item) => new Date(item.startAt).getTime() > openedAt)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 2),
    [events, openedAt],
  );

  /** İxtisasla söz kəsişməsinə görə uyğun müəllimlər; tapılmasa ilk ikisi. */
  const suggestedTeachers = useMemo(() => {
    const words = program.toLocaleLowerCase("az").split(/\s+/).filter((word) => word.length > 3);
    const matched = teachers.filter((teacher) => {
      const haystack = `${teacher.specialty} ${teacher.headline}`.toLocaleLowerCase("az");
      return words.some((word) => haystack.includes(word));
    });
    return (matched.length ? matched : teachers).slice(0, 2);
  }, [teachers, program]);

  const suggestedClubs = useMemo(() => clubs.slice(0, 3), [clubs]);

  const categoryLabel = (value: string) => {
    const key = `clubCategory.${value}`;
    const label = t(key);
    return label === key ? value : label;
  };

  async function joinClub(slug: string) {
    setPending(slug);
    setJoinError("");
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(slug)}/memberships`, { method: "POST" });
      // 409: artıq üzvdür — bu da "qoşuldun" deməkdir.
      if (response.ok || response.status === 409) setJoined((current) => [...current, slug]);
      else setJoinError(response.status === 401 ? "admin.error.session" : "welcome.joinFailed");
    } catch {
      // Əvvəl uğursuz cəhd səssiz keçilirdi — düymə sadəcə geri qayıdırdı.
      setJoinError("welcome.joinFailed");
    } finally {
      setPending("");
    }
  }

  function eventDate(value: string) {
    const parts = bakuDateParts(value);
    return `${Number(parts.day)} ${t(`month.${parts.month}`)}, ${parts.time}`;
  }

  return (
    <section className="welcome-shell">
      <motion.header
        className="welcome-hero"
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="welcome-kicker"><Sparkles size={14} aria-hidden="true" /> {t("welcome.kicker")}</span>
        <h1 className="module-page-title">
          {firstName ? t("welcome.hello", { name: firstName }) : t("welcome.title")}
        </h1>
        <p>
          {program && !program.startsWith("İxtisas məlumatı")
            ? t("welcome.leadProgram", { program })
            : t("welcome.lead")}
        </p>
      </motion.header>

      <ol className="welcome-steps">
        <li className="welcome-step">
          <div className="welcome-step__head">
            <span className="welcome-step__num">01</span>
            <div>
              <h2><CalendarDays size={16} aria-hidden="true" /> {t("welcome.step1.title")}</h2>
              <p>{t("welcome.step1.text")}</p>
            </div>
          </div>
          <Link href="/schedule" className="kuds-primary-button">{t("welcome.step1.action")} <ArrowRight size={15} aria-hidden="true" /></Link>
        </li>

        <li className="welcome-step">
          <div className="welcome-step__head">
            <span className="welcome-step__num">02</span>
            <div>
              <h2><Compass size={16} aria-hidden="true" /> {t("welcome.step2.title")}</h2>
              <p>{t("welcome.step2.text")}</p>
            </div>
          </div>
          <div className="welcome-picks">
            {clubsState === "loading" ? <p className="welcome-none">{t("welcome.clubsLoading")}</p>
              : clubsState === "failed" ? <p className="welcome-none" role="alert">{t("welcome.clubsFailed")}</p>
              : suggestedClubs.length ? suggestedClubs.map((club) => {
                const isJoined = joined.includes(club.slug);
                return (
                  <div key={club.slug} className="welcome-pick">
                    <div>
                      <strong>{club.name}</strong>
                      <small>{categoryLabel(club.category)}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => void joinClub(club.slug)}
                      disabled={isJoined || pending === club.slug}
                      className={isJoined ? "is-done" : ""}
                    >
                      {isJoined ? <><Check size={14} aria-hidden="true" /> {t("welcome.joined")}</> : pending === club.slug ? t("welcome.joining") : t("welcome.join")}
                    </button>
                  </div>
                );
              }) : <p className="welcome-none">{t("welcome.clubsEmpty")}</p>}
            {joinError ? <p className="welcome-none" role="alert">{t(joinError)}</p> : null}
          </div>
        </li>

        <li className="welcome-step">
          <div className="welcome-step__head">
            <span className="welcome-step__num">03</span>
            <div>
              <h2><UsersRound size={16} aria-hidden="true" /> {t("welcome.step3.title")}</h2>
              <p>{t("welcome.step3.text")}</p>
            </div>
          </div>
          <div className="welcome-picks">
            {upcoming.length ? upcoming.map((item) => (
              <Link key={item.id} href="/events" className="welcome-pick welcome-pick--link">
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {eventDate(item.startAt)}
                    {item.location ? ` · ${item.location}` : ""}
                  </small>
                </div>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )) : <p className="welcome-none">{t("welcome.noEvents")}</p>}
          </div>
        </li>
      </ol>

      {suggestedTeachers.length ? (
        <div className="welcome-teachers">
          <h2><GraduationCap size={16} aria-hidden="true" /> {t("welcome.teachers.title")}</h2>
          <p>{t("welcome.teachers.text")}</p>
          <div className="welcome-picks">
            {suggestedTeachers.map((teacher) => (
              <div key={teacher.id} className="welcome-pick">
                <div>
                  <strong>{teacher.name}</strong>
                  <small>{teacher.specialty}</small>
                </div>
              </div>
            ))}
          </div>
          <Link href="/teachers/compare" className="welcome-secondary">{t("welcome.teachers.compare")} <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
      ) : null}

      <div className="welcome-footer">
        <Link href="/profile" className="welcome-secondary">{t("welcome.toProfile")}</Link>
        <Link href="/" className="welcome-skip">{t("welcome.later")}</Link>
      </div>
    </section>
  );
}

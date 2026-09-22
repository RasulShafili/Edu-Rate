"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useT } from "../i18n/LanguageProvider";
import { useAuth } from "./AuthProvider";
import { ErrorState, Skeleton } from "./ui/Primitives";

const ease = [0.22, 1, 0.36, 1] as const;

type MeetingMode = "Onlayn" | "Əyani" | "Hibrid";
type RequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
type LoadState = "idle" | "ready" | "error";

type ProfessionalMentor = {
  id: string;
  profileId: string;
  userId: string | null;
  available: boolean;
  name: string;
  headline: string;
  specialty: string;
  biography: string;
  city: string;
  experienceYears: number;
  availability: string;
  meetingMode: string;
  languages: string[];
  expertise: string[];
};

type MentorCard = {
  /** Kataloq `slug`-ı — POST üçün göndərilir. */
  id: string;
  /** Profilin `uuid`-i — müraciətlər buna bağlanır (`mentorProfileId`). */
  profileId: string;
  userId: string | null;
  name: string;
  initials: string;
  role: string;
  focus: string;
  bio: string;
  city: string;
  experienceYears: number;
  availability: string;
  mode: MeetingMode;
  languages: string[];
  expertise: string[];
  accent: string;
  glow: string;
};

type MentorshipRequest = { id: string; mentorId: string; mentorProfileId?: string; status: RequestStatus };

const mentorPalette = [
  { accent: "#44766c", glow: "rgba(68,118,108,.24)" },
  { accent: "#6f62a8", glow: "rgba(111,98,168,.22)" },
  { accent: "#b48652", glow: "rgba(180,134,82,.2)" },
] as const;

const MODE_KEYS: Record<MeetingMode, string> = { Onlayn: "mentors.mode.online", "Əyani": "mentors.mode.inPerson", Hibrid: "mentors.mode.hybrid" };
const MODES = Object.keys(MODE_KEYS) as MeetingMode[];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join("");
}

function normalizeMentorMode(value: string): MeetingMode {
  return value === "Onlayn" || value === "Əyani" || value === "Hibrid" ? value : "Onlayn";
}

function toMentor(profile: ProfessionalMentor, index: number): MentorCard {
  const color = mentorPalette[index % mentorPalette.length];
  return {
    id: profile.id,
    profileId: profile.profileId,
    userId: profile.userId ?? null,
    name: profile.name,
    initials: initials(profile.name),
    role: profile.headline,
    focus: profile.specialty,
    bio: profile.biography,
    city: profile.city,
    experienceYears: profile.experienceYears,
    availability: profile.availability,
    mode: normalizeMentorMode(profile.meetingMode),
    languages: profile.languages ?? [],
    expertise: profile.expertise ?? [],
    ...color,
  };
}

/** Uğursuz müraciətin səbəbi — tərcümə açarı kimi (dil dəyişəndə də düzgün qalsın). */
function requestFailureKey(status: number, code: string | undefined, fallbackKey: string) {
  if (status === 401) return "mentors.sessionExpired";
  if (status === 403) return code === "STUDENT_ACCOUNT_REQUIRED" ? "mentors.studentOnly" : "mentors.restricted";
  if (status === 404) return "mentors.mentorGone";
  if (status === 409) return "mentors.requestExists";
  if (status === 429) return "mentors.rateLimited";
  return fallbackKey;
}

export function MentorshipDashboard() {
  const t = useT();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mentors, setMentors] = useState<MentorCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [requests, setRequests] = useState<MentorshipRequest[]>([]);
  const [requestsState, setRequestsState] = useState<LoadState>("idle");
  const [requestsErrorKey, setRequestsErrorKey] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ mentorId: string; key: string } | null>(null);
  const [note, setNote] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");
  const [language, setLanguage] = useState("all");

  // Mentorluq müraciəti yalnız tələbə üçündür — backend eyni qaydanı tətbiq edir (D9).
  const isStudent = Boolean(user) && (user?.accessRole ?? "student") === "student";

  const loadMentors = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/catalog/mentors", { cache: "no-store" });
      const payload = await response.json() as { data?: ProfessionalMentor[] };
      if (!response.ok || !Array.isArray(payload.data)) throw new Error(String(response.status));
      setMentors(payload.data.filter((mentor) => mentor.available).map(toMentor));
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetch("/api/mentorship/requests", { cache: "no-store" });
      if (!response.ok) {
        setRequestsErrorKey(response.status === 401 ? "mentors.sessionExpired" : "mentors.statusFailed");
        setRequestsState("error");
        return;
      }
      const payload = await response.json() as { data?: MentorshipRequest[] };
      setRequests(Array.isArray(payload.data) ? payload.data : []);
      setRequestsState("ready");
    } catch {
      // Əvvəl bu xəta udulurdu: tələbə göndərdiyi müraciəti görmür, yenidən
      // göndərir və 409 alırdı.
      setRequestsErrorKey("mentors.statusFailed");
      setRequestsState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMentors(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMentors]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isStudent) {
        void loadRequests();
      } else {
        setRequests([]);
        setRequestsState("idle");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isStudent, loadRequests]);

  /**
   * Hər mentor üçün ən son müraciət. Backend siyahını yenidən köhnəyə qaytarır.
   * Əvvəl açar `mentorProfileId` (uuid), kartın id-si isə `slug` idi — bir-birinə
   * heç vaxt uyğun gəlmirdi, ona görə səhifə yenilənəndən sonra göndərilmiş
   * müraciət itirdi və düymə yenə "müraciət et" deyirdi (klikləyəndə 409).
   */
  const latestRequest = useMemo(() => {
    const byKey = new Map<string, MentorshipRequest>();
    for (const item of requests) {
      // Həm profil uuid-i, həm slug ilə: köhnə sətirlərdə `mentorProfileId` boş ola bilər.
      for (const key of [item.mentorProfileId, item.mentorId]) {
        if (key && !byKey.has(key)) byKey.set(key, item);
      }
    }
    return (mentor: MentorCard) => byKey.get(mentor.profileId) ?? byKey.get(mentor.id);
  }, [requests]);

  const languageOptions = useMemo(
    () => [...new Set(mentors.flatMap((mentor) => mentor.languages))].sort((a, b) => a.localeCompare(b, "az")),
    [mentors],
  );

  const filteredMentors = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("az");
    return mentors.filter((mentor) => {
      const matchesQuery = !normalized || `${mentor.name} ${mentor.role} ${mentor.focus} ${mentor.expertise.join(" ")}`.toLocaleLowerCase("az").includes(normalized);
      const matchesLanguage = language === "all" || mentor.languages.includes(language);
      return matchesQuery && matchesLanguage && (mode === "all" || mentor.mode === mode);
    });
  }, [language, mentors, mode, query]);

  const filtersActive = Boolean(query.trim()) || mode !== "all" || language !== "all";

  function clearFilters() {
    setQuery("");
    setMode("all");
    setLanguage("all");
  }

  function toggle(mentorId: string) {
    setExpandedId((current) => (current === mentorId ? null : mentorId));
    setNote("");
    setCardError(null);
  }

  async function requestMentorship(mentor: MentorCard) {
    if (busyId) return;
    setBusyId(mentor.id);
    setCardError(null);
    try {
      const response = await fetch("/api/mentorship/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mentorId: mentor.id, note: note.trim() }),
      });
      const payload = await response.json().catch(() => null) as { data?: MentorshipRequest; error?: { code?: string } } | null;
      if (!response.ok) {
        setCardError({ mentorId: mentor.id, key: requestFailureKey(response.status, payload?.error?.code, "mentors.requestFailed") });
        // Server artıq müraciət olduğunu deyirsə, vəziyyəti ondan götür.
        if (response.status === 409) void loadRequests();
        return;
      }
      if (payload?.data) setRequests((current) => [payload.data as MentorshipRequest, ...current]);
      setNote("");
      setAnnouncement(t("mentors.sentLive", { name: mentor.name }));
    } catch {
      setCardError({ mentorId: mentor.id, key: "mentors.requestFailed" });
    } finally {
      setBusyId(null);
    }
  }

  async function withdraw(mentor: MentorCard, requestId: string) {
    if (busyId) return;
    setBusyId(mentor.id);
    setCardError(null);
    try {
      const response = await fetch(`/api/mentorship/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
      if (response.ok) {
        setRequests((current) => current.filter((item) => item.id !== requestId));
        return;
      }
      setCardError({ mentorId: mentor.id, key: response.status === 401 ? "mentors.sessionExpired" : "mentors.withdrawFailed" });
      // 404: mentor artıq cavab verib — təzə vəziyyəti göstər.
      if (response.status === 404) void loadRequests();
    } catch {
      setCardError({ mentorId: mentor.id, key: "mentors.withdrawFailed" });
    } finally {
      setBusyId(null);
    }
  }

  function renderAction(mentor: MentorCard) {
    if (!user) {
      return (
        <Link className="mentor-request" href="/auth?returnTo=%2Fmentors">
          <span>{t("mentors.signIn")} <ArrowUpRight size={15} aria-hidden="true" /></span>
        </Link>
      );
    }
    if (mentor.userId && mentor.userId === user.id) {
      return <p className="mentor-request-hint">{t("mentors.ownProfile")}</p>;
    }
    if (!isStudent) {
      return <p className="mentor-request-hint">{t("mentors.studentOnly")}</p>;
    }

    const latest = latestRequest(mentor);
    const busy = busyId === mentor.id;

    if (latest?.status === "accepted") {
      return (
        <>
          <span className="mentor-request is-requested" role="status">
            <span><Check size={16} strokeWidth={2.4} aria-hidden="true" /> {t("mentors.accepted")}</span>
          </span>
          <Link className="mentor-request-secondary" href="/workspace">{t("mentors.openWorkspace")}</Link>
        </>
      );
    }
    if (latest?.status === "pending") {
      return (
        <>
          <span className="mentor-request is-requested" role="status">
            <span><Check size={16} strokeWidth={2.4} aria-hidden="true" /> {t("mentors.pending")}</span>
          </span>
          <button type="button" className="mentor-request-secondary" onClick={() => void withdraw(mentor, latest.id)} disabled={busy}>
            {busy ? t("mentors.withdrawing") : t("mentors.withdraw")}
          </button>
        </>
      );
    }

    const noteId = `mentor-note-${mentor.id}`;
    return (
      <>
        {latest?.status === "rejected" ? <p className="mentor-request-hint">{t("mentors.rejectedHint")}</p> : null}
        {latest?.status === "cancelled" ? <p className="mentor-request-hint">{t("mentors.endedHint")}</p> : null}
        {/* Backend qeydi həmişə qəbul edirdi, interfeys isə heç soruşmurdu —
            mentor müraciəti yalnız ad ilə, kontekstsiz alırdı. */}
        <label className="mentor-request-note" htmlFor={noteId}>
          <span>{t("mentors.noteLabel")}</span>
          <textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={600}
            rows={3}
            placeholder={t("mentors.notePlaceholder")}
          />
        </label>
        <button
          type="button"
          className="mentor-request"
          onClick={() => void requestMentorship(mentor)}
          disabled={busy}
          aria-disabled={busy}
        >
          <span><Sparkles size={15} aria-hidden="true" /> {busy ? t("mentors.sending") : t("mentors.request")}</span>
        </button>
      </>
    );
  }

  return (
    <section id="mentors" className="mentor-section route-module-section" aria-labelledby="mentor-title">
      <div className="mentor-ambient mentor-ambient-one" aria-hidden="true" />
      <div className="mentor-ambient mentor-ambient-two" aria-hidden="true" />

      <motion.div
        className="mentor-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease }}
      >
        <div>
          <span className="mentor-kicker">{t("mentors.eyebrow")}</span>
          <h1 id="mentor-title" className="module-page-title">{t("mentors.title")}</h1>
        </div>
        <div className="mentor-heading-aside">
          <span><Sparkles size={13} aria-hidden="true" /> {t("mentors.aside")}</span>
        </div>
      </motion.div>

      <button
        type="button"
        className="directory-filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="mentor-directory-filters"
        onClick={() => setFiltersOpen((current) => !current)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{t("mentors.filters")}</span>
        <small>{t("mentors.results", { count: filteredMentors.length })}</small>
      </button>
      {/* "Cavab vaxtı" süzgəci silindi: o, uyğun vaxt mətnində "4 saat" kimi
          sözləri axtarırdı — real mentorların mətnində belə söz olmadığı üçün
          "8 saata qədər" hamısını gizlədirdi. Dil seçimləri artıq məlumatdan gəlir. */}
      <div id="mentor-directory-filters" className={`mentor-filters${filtersOpen ? " is-open" : ""}`} aria-label={t("mentors.filtersLabel")}>
        <label><span>{t("mentors.search")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("mentors.searchPlaceholder")} /></label>
        <label>
          <span>{t("mentors.mode")}</span>
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="all">{t("mentors.modeAll")}</option>
            {MODES.map((item) => <option key={item} value={item}>{t(MODE_KEYS[item])}</option>)}
          </select>
        </label>
        <label>
          <span>{t("mentors.language")}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="all">{t("mentors.languageAll")}</option>
            {languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div aria-live="polite">
        {requestsState === "error" ? (
          <p className="schedule-warning is-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {t(requestsErrorKey)}
            <button type="button" className="question-inline-retry" onClick={() => void loadRequests()}>{t("mentors.retry")}</button>
          </p>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">{announcement}</span>

      {isLoading ? (
        <div className="mentor-grid mentor-skeleton-grid" aria-label={t("mentors.loading")}>
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="mentor-card-skeleton" />)}
        </div>
      ) : loadFailed ? (
        <ErrorState
          title={t("mentors.loadFailedTitle")}
          description={t("mentors.loadFailedBody")}
          action={<button type="button" className="kuds-primary-button" onClick={() => void loadMentors()}><RotateCcw size={15} aria-hidden="true" /> {t("mentors.retry")}</button>}
        />
      ) : mentors.length === 0 ? (
        // Production-da mentor olmayanda əvvəl "Bu filtrlərə uyğun mentor tapılmadı"
        // yazılırdı — heç bir filtr seçilmədiyi halda.
        <div className="schedule-empty">
          <Sparkles size={28} aria-hidden="true" />
          <h2>{t("mentors.emptyTitle")}</h2>
          <p>{t("mentors.emptyBody")}</p>
          {user?.accessRole === "teacher" ? (
            <Link className="kuds-primary-button" href="/workspace">{t("mentors.emptyTeacherCta")}</Link>
          ) : null}
        </div>
      ) : (
      <motion.div layout className="mentor-grid" aria-label={t("mentors.listLabel")}>
        {filteredMentors.map((mentor, index) => {
          const expanded = expandedId === mentor.id;
          const detailsId = `mentor-details-${mentor.id}`;
          const triggerId = `mentor-trigger-${mentor.id}`;
          const modeLabel = t(MODE_KEYS[mentor.mode]);
          const availabilityText = mentor.availability || t("mentors.availabilityUnknown");

          return (
            <motion.article
              layout
              key={mentor.id}
              className={`mentor-card${expanded ? " is-expanded" : ""}`}
              style={{
                "--mentor-accent": mentor.accent,
                "--mentor-glow": mentor.glow,
              } as CSSProperties}
              initial={reduceMotion ? false : { opacity: 0, y: 32, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduceMotion || expanded ? undefined : { y: -5, scale: 1.012 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                layout: { duration: reduceMotion ? 0 : 0.52, ease },
                opacity: { duration: 0.55, delay: index * 0.035 },
                y: { duration: 0.55, delay: index * 0.035, ease },
              }}
            >
              <button
                id={triggerId}
                type="button"
                className="mentor-card-trigger"
                onClick={() => toggle(mentor.id)}
                aria-expanded={expanded}
                aria-controls={detailsId}
              >
                {/* Yaşıl "onlayn" nöqtəsi silindi: kataloqda iştirak məlumatı yoxdur,
                    nöqtə isə hər mentorun həmişə onlayn olduğunu iddia edirdi. */}
                <motion.span layout="position" className="mentor-avatar" aria-hidden="true">
                  <span>{mentor.initials}</span>
                </motion.span>

                <motion.span layout="position" className="mentor-identity">
                  <small>{mentor.role}</small>
                  <strong>{mentor.name}</strong>
                  <span>{mentor.focus}</span>
                  <span className="mentor-summary-facts">{modeLabel} · {availabilityText}</span>
                </motion.span>

                <span className="mentor-expand-icon" aria-hidden="true">
                  {expanded ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    id={detailsId}
                    className="mentor-details"
                    role="region"
                    aria-labelledby={triggerId}
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.48, ease }}
                  >
                    <div className="mentor-details-inner">
                      <div className="mentor-story">
                        {mentor.bio ? <p>{mentor.bio}</p> : null}
                      </div>

                      <div className="mentor-practice">
                        {mentor.expertise.length ? (
                          <>
                            <span className="mentor-label">{t("mentors.expertise")}</span>
                            <div className="mentor-expertise">
                              {mentor.expertise.map((item) => <span key={item}>{item}</span>)}
                            </div>
                          </>
                        ) : null}

                        <span className="mentor-label mentor-availability-label">{t("mentors.availability")}</span>
                        <div className="mentor-availability">
                          <span>{availabilityText}</span>
                        </div>
                      </div>

                      <div className="mentor-request-panel">
                        <div className="mentor-facts">
                          <span><MapPin size={13} aria-hidden="true" /> {mentor.city ? `${mentor.city}, ${t("mentors.country")}` : t("mentors.country")} · UTC+4</span>
                          <span>
                            {mentor.experienceYears > 0 ? t("mentors.experienceYears", { count: mentor.experienceYears }) : t("mentors.experienceUnknown")} · {modeLabel}
                          </span>
                          {mentor.languages.length ? <span>{mentor.languages.join(" · ")}</span> : null}
                        </div>

                        <div className="mentor-request-actions">
                          {renderAction(mentor)}
                          {cardError?.mentorId === mentor.id ? (
                            <p className="schedule-warning is-error" role="alert">
                              <TriangleAlert size={14} aria-hidden="true" /> {t(cardError.key)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
        {filteredMentors.length === 0 ? (
          <div className="mentor-filter-empty">
            <p>{t("mentors.filterEmpty")}</p>
            {filtersActive ? (
              <button type="button" className="mentor-request-secondary" onClick={clearFilters}>{t("mentors.clearFilters")}</button>
            ) : null}
          </div>
        ) : null}
      </motion.div>
      )}
    </section>
  );
}

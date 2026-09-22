"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CampusTrail } from "./CampusTrail";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Check,
  GraduationCap,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Sparkles,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import useSWR from "swr";
import {
  canonicalUniversity,
  faculties,
  getProgramsForFaculty,
  isFacultyName,
  isValidFacultyProgram,
  type FacultyName,
} from "../data/academic-programs";
import type { ProfileUpdateInput } from "../data/user";
import { useT } from "../i18n/LanguageProvider";
import { ApiError } from "../lib/api/client";
import { METRIC_KEYS, STATUS_KEYS, TYPE_KEYS } from "../lib/workspace-labels";
import {
  isAuthProviderUnavailable,
  useAuth,
} from "./AuthProvider";
import { SessionManager } from "./SessionManager";
import { SecureImagePicker } from "./SecureImagePicker";
import { useCurrentAvatar } from "../lib/current-avatar";

const ease = [0.22, 1, 0.36, 1] as const;
const enterTransition = { duration: 0.62, ease };
const viewportOnce = { once: true, margin: "-48px" } as const;

const metricIcons: LucideIcon[] = [CalendarDays, UsersRound, Bookmark, BadgeCheck];

type ProfileWorkspace = {
  metrics: Array<{ label: string; value: string | number }>;
  items: Array<{ id: string; title?: string; text?: string; status: string; type?: string }>;
};

type ProfileConnection = {
  id: string;
  name: string;
  role: string;
  program: string;
  city: string;
};

type ProfileMessage = { key: string; tone: "status" | "alert" } | null;

async function loadProfileWorkspace(): Promise<ProfileWorkspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  const payload = await response.json().catch(() => null) as { data?: ProfileWorkspace } | null;
  if (!response.ok || !payload?.data) throw new Error(String(response.status));
  return payload.data;
}

async function loadProfileConnections(currentUserId: string): Promise<ProfileConnection[]> {
  const [usersResponse, connectionsResponse] = await Promise.all([
    fetch("/api/community/users", { cache: "no-store" }),
    fetch("/api/community/connections", { cache: "no-store" }),
  ]);
  if (!usersResponse.ok || !connectionsResponse.ok) throw new Error("connections");
  const usersPayload = await usersResponse.json() as {
    data?: Array<{ id: string; name: string; role: string; program: string; city: string }>;
  };
  const connectionsPayload = await connectionsResponse.json() as {
    data?: Array<{ id: string; requesterId: string; recipientId: string; status: string }>;
  };

  const users = new Map((usersPayload.data ?? []).map((entry) => [entry.id, entry]));
  return (connectionsPayload.data ?? [])
    .filter((entry) => entry.status === "accepted")
    .flatMap((entry) => {
      const peerId = entry.requesterId === currentUserId ? entry.recipientId : entry.requesterId;
      const peer = users.get(peerId);
      return peer ? [{ id: peer.id, name: peer.name, role: peer.role, program: peer.program, city: peer.city }] : [];
    });
}

export function UserProfileDashboard() {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<ProfileMessage>(null);
  const [editFaculty, setEditFaculty] = useState<FacultyName | "">("");
  const [editProgram, setEditProgram] = useState("");
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const reduceMotion = Boolean(useReducedMotion());
  const router = useRouter();
  const {
    credentialAuthAvailable,
    signOut,
    signOutHref,
    status,
    updateProfile,
    user,
  } = useAuth();
  const submitting = status === "submitting";
  const workspace = useSWR(user ? `profile-workspace-summary:${user.id}` : null, loadProfileWorkspace, {
    revalidateOnFocus: false,
  });
  const avatar = useCurrentAvatar(user?.id);
  const profileConnections = useSWR(
    user ? `profile-connections:${user.id}` : null,
    () => loadProfileConnections(user!.id),
    { revalidateOnFocus: false },
  );
  const translate = (map: Record<string, string>, value: string) => (map[value] ? t(map[value]) : value);

  useEffect(() => {
    const refreshConnections = () => { void profileConnections.mutate(); };
    window.addEventListener("edurate:connections-changed", refreshConnections);
    return () => window.removeEventListener("edurate:connections-changed", refreshConnections);
  }, [profileConnections]);

  async function handleSignOut() {
    if (submitting) return;
    setMessage(null);

    try {
      await signOut();
      router.push("/auth");
    } catch (error) {
      setMessage({ key: isAuthProviderUnavailable(error) ? "profile.signOutUnavailable" : "profile.signOutFailed", tone: "alert" });
    }
  }

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || submitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const input: ProfileUpdateInput = {
      name: readValue(formData, "name"),
      university: readValue(formData, "university"),
      faculty: readValue(formData, "faculty"),
      program: readValue(formData, "program"),
      year: readValue(formData, "year"),
      about: readValue(formData, "about"),
    };

    if (!input.name || input.university !== canonicalUniversity) {
      setMessage({ key: "profile.nameUniversityRequired", tone: "alert" });
      return;
    }

    if (user.accessRole === "student" && !isValidFacultyProgram(input.faculty, input.program)) {
      setMessage({ key: "profile.facultyProgramRequired", tone: "alert" });
      return;
    }
    if (user.accessRole !== "student" && input.program.length < 2) {
      setMessage({ key: user.accessRole === "teacher" ? "profile.teachingAreaRequired" : "profile.expertiseRequired", tone: "alert" });
      return;
    }

    try {
      await updateProfile(input);
      setEditing(false);
      setMessage({ key: "profile.updated", tone: "status" });
    } catch (error) {
      setMessage({
        key: isAuthProviderUnavailable(error) ? "profile.storageUnavailable"
          : error instanceof ApiError && error.status === 401 ? "profile.sessionExpired"
            : error instanceof ApiError && error.status === 422 ? "profile.updateInvalid"
              : "profile.updateFailed",
        tone: "alert",
      });
    }
  }

  if (!user) {
    return (
      <section className="profile-section profile-empty-section" aria-labelledby="profile-empty-title">
        <motion.div
          className="profile-empty-card"
          initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={enterTransition}
        >
          <span className="profile-empty-mark" aria-hidden="true"><Sparkles size={20} /></span>
          <span className="profile-kicker">{t("profile.emptyKicker")}</span>
          <h1 id="profile-empty-title">{t("profile.emptyTitle")}</h1>
          <p>{t("profile.emptyBody")}</p>
          <Link href="/auth?returnTo=%2Fprofile" className="profile-empty-action">
            {t("profile.signIn")} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </motion.div>
      </section>
    );
  }

  const isStudent = user.accessRole === "student";
  const roleLabel = t(`role.${user.accessRole ?? "student"}`);
  const programLabel = isStudent ? t("profile.fieldProgram") : user.accessRole === "teacher" ? t("profile.fieldTeachingArea") : t("profile.fieldExpertise");
  const yearLabel = isStudent ? t("profile.fieldYear") : t("profile.fieldPosition");
  const details = user.details;
  // Əvvəl faiz yer tutucu mətnlər doldurulandan sonra hesablanırdı və hamı üçün
  // 100% idi — çatışmayan sahələr indi adbaad göstərilir.
  const missingFields = [
    !details.program ? programLabel : null,
    !details.year ? yearLabel : null,
    !details.about ? t("profile.fieldAbout") : null,
  ].filter(Boolean).join(", ");

  // Göstəricilər yüklənməyibsə saxta sıfır göstərilmir (əvvəl "Yadda
  // saxlananlar 00" kimi mövcud olmayan göstərici də çıxırdı).
  const baseProfileMetrics = (workspace.data?.metrics ?? []).map((metric, index) => ({
    id: `workspace-${index}`,
    label: translate(METRIC_KEYS, metric.label),
    rawLabel: metric.label,
    value: metric.value,
    Icon: metricIcons[index % metricIcons.length],
  }));
  const profileMetrics = [
    ...baseProfileMetrics.filter((metric) => !metric.rawLabel.toLocaleLowerCase("az").includes("əlaqə")),
    {
      id: "connections",
      label: t("profile.connections"),
      rawLabel: "",
      value: profileConnections.isLoading ? "—" : profileConnections.error ? "—" : profileConnections.data?.length ?? 0,
      Icon: UsersRound,
    },
  ];
  const recentItems = workspace.data?.items ?? [];

  return (
    <section className="profile-section" aria-labelledby="profile-title">
      <div className="profile-ambient profile-ambient-one" aria-hidden="true" />
      <div className="profile-ambient profile-ambient-two" aria-hidden="true" />

      <motion.header
        className="profile-hero profile-hero-premium"
        initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={enterTransition}
      >
        <div className="profile-cover-canvas" aria-hidden="true">
          <i className="profile-cover-mesh" />
          <i className="profile-cover-orbit profile-cover-orbit-one" />
          <i className="profile-cover-orbit profile-cover-orbit-two" />
          <span className="profile-cover-monogram">ER</span>
        </div>
        <div className="profile-hero-main">
          <motion.div className="profile-avatar-shell" aria-hidden="true" initial={reduceMotion ? false : { opacity: 0, scale: .72, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: reduceMotion ? 0 : .18 }}>
            <span className={`profile-avatar${avatar.data?.secureUrl ? " has-image" : ""}`}>
              {avatar.data?.secureUrl ? (
                <i
                  className="profile-avatar-photo"
                  style={{ backgroundImage: `url("${avatar.data.secureUrl}")` } as CSSProperties}
                />
              ) : user.initials}
            </span>
            <i className="profile-avatar-orbit" />
            <i className="profile-avatar-status" />
          </motion.div>
          <div className="profile-hero-copy">
            <span className="profile-kicker"><Sparkles size={12} aria-hidden="true" /> {t("profile.kicker")}</span>
            <h1 id="profile-title">{user.name}</h1>
            <p>{details.program || t("profile.notSet")}</p>
            <div className="profile-identity-meta">
              <span><BadgeCheck size={14} aria-hidden="true" /> {roleLabel}</span>
              <span><Mail size={14} aria-hidden="true" /> {user.email}</span>
              <span><MapPin size={14} aria-hidden="true" /> {user.city}</span>
            </div>
          </div>
          <div className="profile-hero-actions">
            {credentialAuthAvailable && (
              <button
                type="button"
                className="profile-edit-button profile-ripple-button"
                aria-expanded={editing}
                aria-controls="profile-edit-panel"
                onClick={() => {
                  if (!editing) {
                    const nextFaculty = isStudent && isFacultyName(user.faculty) ? user.faculty : "";
                    setEditFaculty(nextFaculty);
                    setEditProgram(
                      isStudent ? (isValidFacultyProgram(nextFaculty, details.program) ? details.program : "") : details.program,
                    );
                  }
                  setEditing((open) => !open);
                  setMessage(null);
                }}
              >
                {editing ? <X size={15} aria-hidden="true" /> : <Pencil size={15} aria-hidden="true" />}
                {editing ? t("profile.closeEdit") : t("profile.edit")}
              </button>
            )}
            {signOutHref ? (
              <a href={signOutHref} className="profile-signout-button">
                <LogOut size={15} aria-hidden="true" /> {t("profile.signOut")}
              </a>
            ) : (
              <button type="button" className="profile-signout-button" onClick={handleSignOut} disabled={submitting}>
                <LogOut size={15} aria-hidden="true" /> {t("profile.signOut")}
              </button>
            )}
          </div>
        </div>
      </motion.header>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.section
            id="profile-edit-panel"
            className="profile-edit-panel"
            aria-labelledby="profile-edit-title"
            initial={reduceMotion ? false : { opacity: 0, y: -16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, scale: 0.99 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease }}
          >
            <div className="profile-edit-heading">
              <div>
                <span>{t("profile.editEyebrow")}</span>
                <h2 id="profile-edit-title">{t("profile.editTitle")}</h2>
              </div>
            </div>

            <form className="profile-edit-form" onSubmit={handleProfileUpdate}>
              <div className="profile-image-field"><span>{t("profile.photo")}</span><SecureImagePicker kind="avatar" currentUrl={avatar.data?.secureUrl} onChange={(asset) => void avatar.mutate(asset, false)} /></div>
              <ProfileEditField label={t("profile.fieldName")} name="name" defaultValue={user.name} autoComplete="name" required />
              <label className="profile-edit-field">
                <span>{t("profile.fieldUniversity")}</span>
                <select name="university" defaultValue={canonicalUniversity} autoComplete="organization" required>
                  <option value={canonicalUniversity}>{canonicalUniversity}</option>
                </select>
              </label>
              {isStudent ? <label className="profile-edit-field">
                <span>{t("profile.fieldFaculty")}</span>
                <select
                  name="faculty"
                  value={editFaculty}
                  autoComplete="organization-title"
                  onChange={(event) => {
                    const faculty = event.target.value;
                    setEditFaculty(isFacultyName(faculty) ? faculty : "");
                    setEditProgram("");
                  }}
                  required
                >
                  <option value="" disabled>{t("profile.chooseFaculty")}</option>
                  {faculties.map((faculty) => <option key={faculty} value={faculty}>{faculty}</option>)}
                </select>
              </label> : <input type="hidden" name="faculty" value={user.faculty} />}
              <label className="profile-edit-field">
                <span>{programLabel}</span>
                {isStudent ? <select
                  name="program"
                  value={editProgram}
                  onChange={(event) => setEditProgram(event.target.value)}
                  disabled={!editFaculty}
                  required
                >
                  <option value="" disabled>{editFaculty ? t("profile.chooseProgram") : t("profile.chooseFacultyFirst")}</option>
                  {getProgramsForFaculty(editFaculty).map((program) => (
                    <option key={program} value={program}>{program}</option>
                  ))}
                </select> : <input name="program" type="text" value={editProgram} onChange={(event) => setEditProgram(event.target.value)} required />}
              </label>
              {/* Yer tutucu ("Kurs məlumatı əlavə edilməyib") əvvəl sahənin DƏYƏRİ kimi
                  gəlirdi və "Yadda saxla" onu real kurs kimi yazırdı. Backend sahəni
                  məcburi sayır — forma da indi bunu bildirir. */}
              <ProfileEditField
                label={yearLabel}
                name="year"
                defaultValue={details.year}
                placeholder={t(isStudent ? "profile.yearPlaceholder" : "profile.positionPlaceholder")}
                required
              />
              <label className="profile-edit-field profile-edit-about">
                <span>{t("profile.fieldAbout")}</span>
                <textarea name="about" defaultValue={details.about} maxLength={280} rows={4} />
              </label>

              <div className="profile-edit-footer">
                <button type="button" onClick={() => setEditing(false)} disabled={submitting}>{t("profile.cancel")}</button>
                <motion.button
                  type="submit"
                  className="profile-save-button"
                  disabled={submitting}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                >
                  <Check size={15} aria-hidden="true" /> {submitting ? t("profile.saving") : t("profile.save")}
                </motion.button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Mesajın növü əvvəl azərbaycanca mətndə söz axtarmaqla təyin olunurdu. */}
      <p
        className={`profile-status-message${message ? " is-visible" : ""}`}
        role={message?.tone === "alert" ? "alert" : "status"}
        aria-live="polite"
      >
        {message ? t(message.key) : ""}
      </p>

      <SessionManager />

      <CampusTrail />
      {workspace.error ? (
        <p className="schedule-warning is-error" role="alert">
          {t("profile.metricsFailed")}{" "}
          <button type="button" className="question-inline-retry" onClick={() => void workspace.mutate()}>{t("profile.retry")}</button>
        </p>
      ) : null}
      <motion.div
        className="profile-stats"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={enterTransition}
        aria-label={t("profile.statsLabel")}
        aria-busy={workspace.isLoading}
      >
        {profileMetrics.map((stat, index) => {
          const Icon = stat.Icon;
          const value = typeof stat.value === "number" ? String(stat.value).padStart(2, "0") : stat.value;
          return (
            <motion.button
              key={stat.id}
              type="button"
              className={`profile-stat-card profile-stat-tone-${index % 4}${stat.id === "connections" ? " profile-stat-button" : ""}`}
              onClick={stat.id === "connections" ? () => setConnectionsOpen(true) : undefined}
              disabled={stat.id !== "connections"}
              aria-haspopup={stat.id === "connections" ? "dialog" : undefined}
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: .97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={reduceMotion ? undefined : { y: -6, scale: 1.018 }}
              transition={{ duration: .5, ease, delay: reduceMotion ? 0 : .32 + index * .1 }}
            >
              <span><Icon size={18} aria-hidden="true" /></span>
              <strong>{value}</strong>
              <p>{stat.label}</p>
              <i aria-hidden="true"><Icon size={72} /></i>
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {connectionsOpen ? (
          <motion.div
            className="profile-connections-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="profile-connections-backdrop" onClick={() => setConnectionsOpen(false)} aria-label={t("profile.connectionsClose")} />
            <motion.section
              className="profile-connections-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-connections-title"
              initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 32 }}
            >
              <header>
                <div><span>{t("profile.connectionsEyebrow")}</span><h2 id="profile-connections-title">{t("profile.connectionsTitle")}</h2></div>
                <button type="button" onClick={() => setConnectionsOpen(false)} aria-label={t("profile.close")}><X size={18} aria-hidden="true" /></button>
              </header>
              {profileConnections.error ? (
                <p className="profile-connections-empty" role="alert">{t("profile.connectionsFailed")}</p>
              ) : profileConnections.isLoading ? (
                <div className="profile-connections-loading" aria-label={t("profile.connectionsLoading")}><i /><i /><i /></div>
              ) : profileConnections.data?.length ? (
                <ul className="profile-connections-list">
                  {profileConnections.data.map((connection) => (
                    <li key={connection.id}>
                      <span className="profile-connection-avatar" aria-hidden="true">{connection.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("az")}</span>
                      <div><strong>{connection.name}</strong><small>{connection.program || t(`role.${connection.role}`)}{connection.city ? ` · ${connection.city}` : ""}</small></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="profile-connections-empty">{t("profile.connectionsEmpty")}</p>
              )}
              <Link href="/community" className="profile-connections-link" onClick={() => setConnectionsOpen(false)}>{t("profile.openCommunity")} <ArrowRight size={15} aria-hidden="true" /></Link>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="profile-dashboard-grid">
        <motion.article
          className="profile-info-card profile-about-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -5, scale: 1.008 }}
          viewport={viewportOnce}
          transition={enterTransition}
        >
          <span className="profile-card-number">01</span>
          <div>
            <span className="profile-card-kicker">{t("profile.educationKicker")}</span>
            <h2>{isStudent ? t("profile.academicProfile") : t("profile.professionalProfile")}</h2>
            <p>{details.about || t("profile.aboutMissing")}</p>
          </div>
          <dl className="profile-facts">
            <div><dt>{t("profile.fieldUniversity")}</dt><dd>{user.university}</dd></div>
            {isStudent && <div><dt>{t("profile.fieldFaculty")}</dt><dd>{user.faculty}</dd></div>}
            <div><dt>{programLabel}</dt><dd>{details.program || t("profile.notSet")}</dd></div>
            <div><dt>{yearLabel}</dt><dd>{details.year || t("profile.notSet")}</dd></div>
          </dl>
        </motion.article>

        <motion.article
          className="profile-info-card profile-progress-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -5, scale: 1.008 }}
          viewport={viewportOnce}
          transition={{ ...enterTransition, delay: reduceMotion ? 0 : 0.06 }}
        >
          <span className="profile-card-number">02</span>
          <div className="profile-progress-layout">
            <div className="profile-progress-ring" role="progressbar" aria-label={t("profile.progressLabel")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={user.completion}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="profile-progress-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#347c70" /><stop offset=".52" stopColor="#79b768" /><stop offset="1" stopColor="#9c83dc" /></linearGradient></defs>
                <circle className="profile-progress-ring-track" cx="60" cy="60" r="52" />
                <motion.circle className="profile-progress-ring-value" cx="60" cy="60" r="52" initial={reduceMotion ? false : { pathLength: 0 }} whileInView={{ pathLength: user.completion / 100 }} viewport={viewportOnce} transition={{ duration: reduceMotion ? 0 : 1.25, ease }} />
              </svg>
              <strong><AnimatedNumber value={user.completion} reduced={reduceMotion} /><small>%</small></strong>
            </div>
            <div className="profile-progress-copy">
              <span className="profile-card-kicker">{t("profile.progressKicker")}</span>
              <h2>{user.completion >= 100 ? t("profile.progressDone") : t("profile.progressTodo")}</h2>
              <p>{user.completion >= 100 || !missingFields ? t("profile.progressDoneBody") : t("profile.progressTodoBody", { fields: missingFields })}</p>
            </div>
          </div>
        </motion.article>

        <motion.article
          className="profile-info-card profile-interests-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -5, scale: 1.008 }}
          viewport={viewportOnce}
          transition={enterTransition}
        >
          <span className="profile-card-number">03</span>
          <div>
            <span className="profile-card-kicker">{t("profile.accountKicker")}</span>
            <h2>{t("profile.accountTitle")}</h2>
          </div>
          <dl className="profile-account-details">
            <div><dt>{t("profile.email")}</dt><dd><Mail size={14} aria-hidden="true" />{user.email}</dd></div>
            <div><dt>{t("profile.accountType")}</dt><dd><BadgeCheck size={14} aria-hidden="true" />{roleLabel}</dd></div>
            <div><dt>{t("profile.direction")}</dt><dd><GraduationCap size={14} aria-hidden="true" />{details.program || t("profile.notSet")}</dd></div>
          </dl>
        </motion.article>

        <motion.article
          className="profile-info-card profile-activity-card"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -5, scale: 1.008 }}
          viewport={viewportOnce}
          transition={{ ...enterTransition, delay: reduceMotion ? 0 : 0.06 }}
        >
          <span className="profile-card-number">04</span>
          <div>
            <span className="profile-card-kicker">{t("profile.activityKicker")}</span>
            <h2>{t("profile.activityTitle")}</h2>
          </div>
          {recentItems.length > 0 ? (
            <ol className="profile-activity-list">
              {recentItems.slice(0, 5).map((activity) => (
                <li key={activity.id}>
                  <span className="profile-activity-dot" aria-hidden="true" />
                  <div>
                    <span>{activity.type ? translate(TYPE_KEYS, activity.type) : t("profile.activityDefault")}</span>
                    <h3>{activity.title ?? t("profile.activityDefaultTitle")}</h3>
                    {activity.text ? <p>{activity.text}</p> : null}
                  </div>
                  {/* Əvvəl <time> içində xam "pending" / "open" yazılırdı. */}
                  <span className="profile-activity-status">{translate(STATUS_KEYS, activity.status)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="profile-empty-copy">{t("profile.activityEmpty")}</p>
          )}
        </motion.article>
      </div>
    </section>
  );
}

type ProfileEditFieldProps = {
  label: string;
  name: keyof ProfileUpdateInput;
  defaultValue: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
};

function ProfileEditField({
  label,
  name,
  defaultValue,
  autoComplete,
  placeholder,
  required = false,
}: ProfileEditFieldProps) {
  return (
    <label className="profile-edit-field">
      <span>{label}</span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function readValue(formData: FormData, field: keyof ProfileUpdateInput): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function AnimatedNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) return;

    let frame = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return <>{reduced ? value : display}</>;
}

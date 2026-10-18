"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Check,
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
    <section className="profile-section profile-section-compact" aria-labelledby="profile-title">
      <header className="profile-hero profile-hero-compact">
        <div className="profile-hero-main">
          <div className="profile-avatar-shell" aria-hidden="true">
            <span className={`profile-avatar${avatar.data?.secureUrl ? " has-image" : ""}`}>
              {avatar.data?.secureUrl ? (
                <i
                  className="profile-avatar-photo"
                  style={{ backgroundImage: `url("${avatar.data.secureUrl}")` } as CSSProperties}
                />
              ) : user.initials}
            </span>
            <i className="profile-avatar-status" />
          </div>
          <div className="profile-hero-copy">
            <div className="profile-title-row">
              <h1 id="profile-title">{user.name}</h1>
              <span className="profile-role-badge"><BadgeCheck size={13} aria-hidden="true" /> {roleLabel}</span>
            </div>
            <p>{details.program || t("profile.notSet")}</p>
            <div className="profile-identity-meta">
              <span><Mail size={13} aria-hidden="true" /> {user.email}</span>
              {user.city ? <span><MapPin size={13} aria-hidden="true" /> {user.city}</span> : null}
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
                {editing ? <X size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
                {editing ? t("profile.closeEdit") : t("profile.edit")}
              </button>
            )}
            {signOutHref ? (
              <a href={signOutHref} className="profile-signout-button">
                <LogOut size={14} aria-hidden="true" /> {t("profile.signOut")}
              </a>
            ) : (
              <button type="button" className="profile-signout-button" onClick={handleSignOut} disabled={submitting}>
                <LogOut size={14} aria-hidden="true" /> {t("profile.signOut")}
              </button>
            )}
          </div>
        </div>

        <div className="profile-stats-bar" aria-label={t("profile.statsLabel")} aria-busy={workspace.isLoading}>
          {profileMetrics.map((stat) => {
            const Icon = stat.Icon;
            const value = typeof stat.value === "number" ? String(stat.value) : stat.value;
            const isConn = stat.id === "connections";
            return (
              <button
                key={stat.id}
                type="button"
                className={`profile-stat-pill${isConn ? " is-interactive" : ""}`}
                onClick={isConn ? () => setConnectionsOpen(true) : undefined}
                disabled={!isConn}
                aria-haspopup={isConn ? "dialog" : undefined}
              >
                <Icon size={14} aria-hidden="true" />
                <strong>{value}</strong>
                <span>{stat.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.section
            id="profile-edit-panel"
            className="profile-edit-panel"
            aria-labelledby="profile-edit-title"
            initial={reduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease }}
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
              <ProfileEditField
                label={yearLabel}
                name="year"
                defaultValue={details.year}
                placeholder={t(isStudent ? "profile.yearPlaceholder" : "profile.positionPlaceholder")}
                required
              />
              <label className="profile-edit-field profile-edit-about">
                <span>{t("profile.fieldAbout")}</span>
                <textarea name="about" defaultValue={details.about} maxLength={280} rows={3} />
              </label>

              <div className="profile-edit-footer">
                <button type="button" onClick={() => setEditing(false)} disabled={submitting}>{t("profile.cancel")}</button>
                <button
                  type="submit"
                  className="profile-save-button"
                  disabled={submitting}
                >
                  <Check size={15} aria-hidden="true" /> {submitting ? t("profile.saving") : t("profile.save")}
                </button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <p
        className={`profile-status-message${message ? " is-visible" : ""}`}
        role={message?.tone === "alert" ? "alert" : "status"}
        aria-live="polite"
      >
        {message ? t(message.key) : ""}
      </p>

      {workspace.error ? (
        <p className="schedule-warning is-error" role="alert">
          {t("profile.metricsFailed")}{" "}
          <button type="button" className="question-inline-retry" onClick={() => void workspace.mutate()}>{t("profile.retry")}</button>
        </p>
      ) : null}

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
        <article className="profile-info-card profile-about-card">
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
        </article>

        <article className="profile-info-card profile-activity-card">
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
                  <span className="profile-activity-status">{translate(STATUS_KEYS, activity.status)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="profile-empty-copy">{t("profile.activityEmpty")}</p>
          )}
        </article>
      </div>

      <SessionManager />
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

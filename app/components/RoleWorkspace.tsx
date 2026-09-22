"use client";

import { Check, HeartHandshake, MessageCircle, Pencil, RefreshCw, Send, UserMinus, X } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import useSWR from "swr";
import { ApiError, createApiClient } from "../lib/api/client";
import type { Peer } from "../data/peers";
import { useT } from "../i18n/LanguageProvider";
import { CHAT_ROLE_KEYS, METRIC_KEYS, STATUS_KEYS, TYPE_KEYS, translateLabel } from "../lib/workspace-labels";
import { usePlatform } from "./PlatformProvider";

type Role = "student" | "teacher" | "mentor";
type MeetingMode = "Onlayn" | "Əyani" | "Hibrid";
type WorkspaceMetric = { label: string; value: string | number };
type WorkspaceChatPeer = { id: string; name: string; role: string; focus: string; city: string };
type WorkspaceItem = {
  id: string;
  title?: string;
  text?: string;
  note?: string;
  course?: string;
  semester?: string;
  status: string;
  type?: string;
  rating?: number;
  chatPeer?: WorkspaceChatPeer;
};
type MentorApplication = {
  id: string;
  specialty: string;
  biography: string;
  availability: string;
  meetingMode: string;
  languages: string[];
  status: "pending" | "approved" | "rejected";
};
type MentorDetails = { availability: string; meetingMode: string; languages: string[]; experienceYears: number };
type WorkspaceData = {
  role: Role;
  title: string;
  focus: string;
  metrics: WorkspaceMetric[];
  items: WorkspaceItem[];
  mentorApplication?: MentorApplication | null;
  mentorEnabled?: boolean;
  mentorItems?: WorkspaceItem[];
  mentorDetails?: MentorDetails | null;
};

const api = createApiClient({ baseUrl: "/api" });

const MODES: Array<{ value: MeetingMode; key: string }> = [
  { value: "Onlayn", key: "mentors.mode.online" },
  { value: "Əyani", key: "mentors.mode.inPerson" },
  { value: "Hibrid", key: "mentors.mode.hybrid" },
];
// Dəyər kataloqda olduğu kimi saxlanılır (Mentorlar süzgəci onu oxuyur); görünən ad tərcümədir.
const LANGUAGES = [
  { value: "Azərbaycan dili", key: "lang.az" },
  { value: "İngilis dili", key: "lang.en" },
  { value: "Rus dili", key: "lang.ru" },
];

export function RoleWorkspace() {
  const t = useT();
  const { openConversation } = usePlatform();
  const loader = useCallback(() => api.get<WorkspaceData>("/workspace"), []);
  const { data, error, isLoading, isValidating, mutate } = useSWR("role-workspace", loader, { revalidateOnFocus: false });
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState("");
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [applicationPending, setApplicationPending] = useState(false);
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<{ key: string; tone: "status" | "alert" } | null>(null);

  async function decide(id: string, status: "accepted" | "rejected" | "cancelled") {
    setActionId(id);
    setActionErrorKey("");
    try {
      await api.patch(`/workspace/mentorship/${encodeURIComponent(id)}`, { status });
      setConfirmingRemovalId(null);
      await mutate();
    } catch (decisionError) {
      // 404: tələbə müraciəti geri çəkib və ya o artıq cavablanıb. Əvvəl ümumi
      // xəta çıxırdı və köhnə element siyahıda qalırdı.
      const status404 = decisionError instanceof ApiError && decisionError.status === 404;
      setActionErrorKey(
        status404 ? "workspace.decideGone"
          : decisionError instanceof ApiError && decisionError.status === 401 ? "workspace.sessionExpired"
            : "workspace.decideFailed",
      );
      if (status404) {
        setConfirmingRemovalId(null);
        await mutate();
      }
    } finally {
      setActionId(null);
    }
  }

  async function submitMentorApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplicationPending(true);
    setActionErrorKey("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api.post("/workspace/mentor-application", {
        specialty: String(values.get("specialty") ?? "").trim(),
        biography: String(values.get("biography") ?? "").trim(),
        availability: String(values.get("availability") ?? "").trim(),
        meetingMode: String(values.get("meetingMode") ?? "Onlayn"),
        languages: [String(values.get("language") ?? "Azərbaycan dili")],
      });
      setApplicationOpen(false);
      form.reset();
      await mutate();
    } catch (submissionError) {
      const status = submissionError instanceof ApiError ? submissionError.status : 0;
      setActionErrorKey(
        status === 409 ? "workspace.applicationExists"
          : status === 403 ? "workspace.teacherOnly"
            : status === 422 ? "workspace.applicationInvalid"
              : status === 401 ? "workspace.sessionExpired"
                : "workspace.applicationFailed",
      );
    } finally {
      setApplicationPending(false);
    }
  }

  async function saveMentorDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const languages = values.getAll("languages").map(String);
    if (!languages.length) {
      setDetailsMessage({ key: "workspace.detailsLanguagesRequired", tone: "alert" });
      return;
    }
    setDetailsSaving(true);
    setDetailsMessage(null);
    try {
      await api.patch("/workspace/mentor-profile", {
        availability: String(values.get("availability") ?? "").trim(),
        meetingMode: String(values.get("meetingMode") ?? "Onlayn"),
        languages,
        experienceYears: Number(values.get("experienceYears") ?? 0),
      });
      setDetailsOpen(false);
      setDetailsMessage({ key: "workspace.detailsSaved", tone: "status" });
      await mutate();
    } catch (saveError) {
      setDetailsMessage({
        key: saveError instanceof ApiError && saveError.status === 401 ? "workspace.sessionExpired" : "workspace.detailsFailed",
        tone: "alert",
      });
    } finally {
      setDetailsSaving(false);
    }
  }

  if (isLoading) return <section className="role-workspace is-loading"><div className="workspace-skeleton"><i /><i /><i /></div></section>;
  if (error || !data) {
    const expired = error instanceof ApiError && error.status === 401;
    return (
      <section className="role-workspace">
        <div className="workspace-state" role="alert">
          <h1>{t("workspace.loadFailedTitle")}</h1>
          <p>{t(expired ? "workspace.sessionExpired" : "workspace.loadFailedBody")}</p>
          <button type="button" onClick={() => void mutate()}><RefreshCw size={15} aria-hidden="true" /> {t("workspace.retry")}</button>
        </div>
      </section>
    );
  }

  const mentorApplication = data.mentorApplication;
  const canApplyForMentorship = data.role === "teacher"
    && !data.mentorEnabled
    && (!mentorApplication || mentorApplication.status === "rejected");
  const isActiveMentor = data.role === "mentor" || (data.role === "teacher" && data.mentorEnabled);

  function openMentorApplication() {
    setApplicationOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("mentor-path-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function openMentorshipChat(chatPeer: WorkspaceChatPeer) {
    const initials = chatPeer.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join("");
    openConversation({
      id: chatPeer.id,
      name: chatPeer.name,
      initials,
      // Söhbət paneli rolu `t()` ilə açır — ona tərcümə açarı lazımdır.
      role: CHAT_ROLE_KEYS[chatPeer.role] ?? chatPeer.role,
      focus: chatPeer.focus,
      bio: "",
      city: chatPeer.city,
      status: "online",
      accent: "#8fc15f",
      glow: "rgba(143, 193, 95, 0.28)",
      mutuals: 0,
      tags: [],
      openingMessage: "",
      reply: "",
    } satisfies Peer);
  }

  const details = data.mentorDetails;
  const detailsFilled = Boolean(details && (details.availability || details.languages.length || details.experienceYears));

  return (
    <section className="role-workspace" aria-labelledby="workspace-title" aria-busy={isValidating}>
      <header className="workspace-header">
        <div>
          <span>{t(`workspace.eyebrow.${data.role}`)}</span>
          <h1 id="workspace-title">{t(`workspace.title.${data.role}`)}</h1>
          <p>{data.focus}</p>
        </div>
        <div className="workspace-header-actions">
          {canApplyForMentorship && (
            <button type="button" className="is-primary" onClick={openMentorApplication}>
              <HeartHandshake size={15} aria-hidden="true" /> {mentorApplication?.status === "rejected" ? t("workspace.applyAgain") : t("workspace.applyButton")}
            </button>
          )}
          {data.role === "teacher" && mentorApplication?.status === "pending" && <span className="workspace-header-status">{t("workspace.statusReviewing")}</span>}
          {data.role === "teacher" && data.mentorEnabled && <span className="workspace-header-status is-approved"><Check size={14} aria-hidden="true" /> {t("workspace.statusActive")}</span>}
          <button type="button" onClick={() => void mutate()} disabled={isValidating}><RefreshCw size={15} aria-hidden="true" /> {t("workspace.refresh")}</button>
        </div>
      </header>
      <div className="workspace-metrics">
        {data.metrics.map((metric) => (
          <article key={metric.label}>
            <span>{translateLabel(METRIC_KEYS, metric.label, t)}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      {data.role === "teacher" && (
        <section className="workspace-mentor-path" aria-labelledby="mentor-path-title">
          <div className="workspace-mentor-copy">
            <span><HeartHandshake size={15} aria-hidden="true" /> {t("workspace.pathEyebrow")}</span>
            <h2 id="mentor-path-title">{t("workspace.pathTitle")}</h2>
            <p>{t("workspace.pathBody")}</p>
          </div>

          {data.mentorEnabled ? (
            <div className="workspace-mentor-status is-approved"><Check size={16} aria-hidden="true" /><span><strong>{t("workspace.activeTitle")}</strong><small>{t("workspace.activeBody")}</small></span></div>
          ) : mentorApplication?.status === "pending" ? (
            <div className="workspace-mentor-status"><RefreshCw size={16} aria-hidden="true" /><span><strong>{t("workspace.reviewingTitle")}</strong><small>{t("workspace.reviewingBody")}</small></span></div>
          ) : applicationOpen ? (
            <form className="workspace-mentor-form" onSubmit={submitMentorApplication}>
              <label><span>{t("workspace.fieldSpecialty")}</span><input name="specialty" defaultValue={mentorApplication?.specialty ?? data.focus} minLength={2} maxLength={180} required /></label>
              <label className="is-wide"><span>{t("workspace.fieldBio")}</span><textarea name="biography" rows={4} minLength={20} maxLength={1200} defaultValue={mentorApplication?.biography ?? ""} placeholder={t("workspace.bioPlaceholder")} required /></label>
              <label><span>{t("workspace.fieldAvailability")}</span><input name="availability" defaultValue={mentorApplication?.availability ?? ""} placeholder={t("workspace.availabilityPlaceholder")} minLength={2} maxLength={240} required /></label>
              <label><span>{t("workspace.fieldMode")}</span><select name="meetingMode" defaultValue={mentorApplication?.meetingMode ?? "Onlayn"}>{MODES.map((mode) => <option key={mode.value} value={mode.value}>{t(mode.key)}</option>)}</select></label>
              <label><span>{t("workspace.fieldLanguage")}</span><select name="language" defaultValue={mentorApplication?.languages[0] ?? "Azərbaycan dili"}>{LANGUAGES.map((language) => <option key={language.value} value={language.value}>{t(language.key)}</option>)}</select></label>
              <div className="workspace-mentor-actions"><button type="button" onClick={() => setApplicationOpen(false)} disabled={applicationPending}>{t("workspace.cancel")}</button><button type="submit" disabled={applicationPending}><Send size={14} aria-hidden="true" /> {applicationPending ? t("workspace.sending") : t("workspace.send")}</button></div>
            </form>
          ) : canApplyForMentorship ? (
            <>
              {/* Rədd edilmiş müraciət əvvəl heç izah olunmurdu — yalnız düymənin mətni dəyişirdi. */}
              {mentorApplication?.status === "rejected" ? <p className="workspace-mentor-note">{t("workspace.rejectedNote")}</p> : null}
              <button type="button" className="workspace-mentor-apply" onClick={openMentorApplication}><HeartHandshake size={16} aria-hidden="true" /> {mentorApplication?.status === "rejected" ? t("workspace.applyAgain") : t("workspace.applyCta")}</button>
            </>
          ) : null}
        </section>
      )}

      {isActiveMentor && details ? (
        <section className="workspace-mentor-details" aria-labelledby="mentor-details-title">
          <header>
            <div>
              <h2 id="mentor-details-title">{t("workspace.detailsTitle")}</h2>
              <p>{t("workspace.detailsBody")}{data.role === "mentor" ? ` ${t("workspace.detailsBioHint")}` : ""}</p>
            </div>
            {!detailsOpen ? (
              <button type="button" onClick={() => { setDetailsOpen(true); setDetailsMessage(null); }}>
                <Pencil size={14} aria-hidden="true" /> {t("workspace.detailsEdit")}
              </button>
            ) : null}
          </header>
          {detailsOpen ? (
            <form className="workspace-mentor-form" onSubmit={(event) => void saveMentorDetails(event)}>
              <label className="is-wide"><span>{t("workspace.fieldAvailability")}</span><input name="availability" defaultValue={details.availability} placeholder={t("workspace.availabilityPlaceholder")} maxLength={240} /></label>
              <label><span>{t("workspace.fieldMode")}</span><select name="meetingMode" defaultValue={details.meetingMode}>{MODES.map((mode) => <option key={mode.value} value={mode.value}>{t(mode.key)}</option>)}</select></label>
              <label><span>{t("workspace.fieldExperience")}</span><input name="experienceYears" type="number" min={0} max={60} defaultValue={details.experienceYears} /></label>
              <fieldset className="is-wide workspace-language-options">
                <legend>{t("workspace.fieldLanguages")}</legend>
                {LANGUAGES.map((language) => (
                  <label key={language.value}>
                    <input type="checkbox" name="languages" value={language.value} defaultChecked={details.languages.includes(language.value)} />
                    {t(language.key)}
                  </label>
                ))}
              </fieldset>
              <div className="workspace-mentor-actions">
                <button type="button" onClick={() => setDetailsOpen(false)} disabled={detailsSaving}>{t("workspace.cancel")}</button>
                <button type="submit" disabled={detailsSaving}><Check size={14} aria-hidden="true" /> {detailsSaving ? t("workspace.detailsSaving") : t("workspace.detailsSave")}</button>
              </div>
            </form>
          ) : detailsFilled ? (
            <dl className="workspace-mentor-facts">
              <div><dt>{t("workspace.fieldAvailability")}</dt><dd>{details.availability || t("profile.notSet")}</dd></div>
              <div><dt>{t("workspace.fieldMode")}</dt><dd>{t(MODES.find((mode) => mode.value === details.meetingMode)?.key ?? "mentors.mode.online")}</dd></div>
              <div><dt>{t("workspace.fieldLanguages")}</dt><dd>{details.languages.length ? details.languages.map((value) => t(LANGUAGES.find((language) => language.value === value)?.key ?? value)).join(", ") : t("profile.notSet")}</dd></div>
              <div><dt>{t("workspace.fieldExperience")}</dt><dd>{details.experienceYears ? t("workspace.years", { count: details.experienceYears }) : t("profile.notSet")}</dd></div>
            </dl>
          ) : (
            <p className="workspace-mentor-note">{t("workspace.detailsEmpty")}</p>
          )}
          <div aria-live="polite">
            {detailsMessage ? <p className={detailsMessage.tone === "alert" ? "workspace-action-error" : "workspace-mentor-note"} role={detailsMessage.tone === "alert" ? "alert" : "status"}>{t(detailsMessage.key)}</p> : null}
          </div>
        </section>
      ) : null}

      <div aria-live="polite">
        {actionErrorKey ? <p className="workspace-action-error" role="alert">{t(actionErrorKey)}</p> : null}
      </div>
      <WorkspaceQueue
        title={t(`workspace.queue.${data.role}`)}
        note={data.role === "teacher" ? t("workspace.teacherQueueNote") : undefined}
        role={data.role}
        items={data.items}
        allowActions={data.role === "mentor"}
        actionId={actionId}
        confirmingRemovalId={confirmingRemovalId}
        onConfirmRemoval={setConfirmingRemovalId}
        onDecide={decide}
        onMessage={openMentorshipChat}
      />
      {data.role === "teacher" && data.mentorEnabled && (
        <WorkspaceQueue title={t("workspace.queue.mentor")} role="mentor" items={data.mentorItems ?? []} allowActions actionId={actionId} confirmingRemovalId={confirmingRemovalId} onConfirmRemoval={setConfirmingRemovalId} onDecide={decide} onMessage={openMentorshipChat} />
      )}
    </section>
  );
}

function WorkspaceQueue({ title, note, role, items, allowActions, actionId, confirmingRemovalId, onConfirmRemoval, onDecide, onMessage }: {
  title: string;
  note?: string;
  role: Role;
  items: WorkspaceItem[];
  allowActions: boolean;
  actionId: string | null;
  confirmingRemovalId: string | null;
  onConfirmRemoval: (id: string | null) => void;
  onDecide: (id: string, status: "accepted" | "rejected" | "cancelled") => Promise<void>;
  onMessage: (peer: WorkspaceChatPeer) => void;
}) {
  const t = useT();
  return (
    <section className="workspace-queue" aria-label={title}>
      <header><span>{t("workspace.live")}</span><h2>{title}</h2>{note ? <p>{note}</p> : null}</header>
      {!items.length ? (
        <div className="workspace-state"><h3>{t("workspace.emptyTitle")}</h3><p>{t("workspace.emptyBody")}</p></div>
      ) : (
        <div className="workspace-items">
          {items.map((item) => {
            // Rəydə başlıq yoxdur — əvvəl hər rəy "Mentorluq müraciəti" başlığı ilə görünürdü.
            const heading = role === "teacher"
              ? t("workspace.reviewTitle", { semester: item.semester ?? "" })
              : item.title ?? item.note ?? t("workspace.mentorshipFallback");
            const kicker = item.course ?? (item.type ? translateLabel(TYPE_KEYS, item.type, t) : t("workspace.requestFallback"));
            return (
              <article key={item.id}>
                <div><span>{kicker}</span>{item.rating !== undefined && <strong>{item.rating.toFixed(1)} / 5</strong>}</div>
                <h3>{heading}</h3>
                {item.text && <p>{item.text}</p>}
                <footer>
                  <small>{translateLabel(STATUS_KEYS, item.status, t)}</small>
                  {allowActions && item.status === "pending" ? (
                    <div>
                      <button type="button" onClick={() => void onDecide(item.id, "rejected")} disabled={actionId === item.id}><X size={14} aria-hidden="true" /> {t("workspace.reject")}</button>
                      <button type="button" onClick={() => void onDecide(item.id, "accepted")} disabled={actionId === item.id}><Check size={14} aria-hidden="true" /> {t("workspace.accept")}</button>
                    </div>
                  ) : allowActions && item.status === "accepted" ? (
                    <div>
                      <button type="button" className="workspace-message-button" onClick={() => item.chatPeer && onMessage(item.chatPeer)} disabled={!item.chatPeer}><MessageCircle size={14} aria-hidden="true" /> {t("workspace.message")}</button>
                      <button
                        type="button"
                        className={`workspace-remove-button${confirmingRemovalId === item.id ? " is-confirming" : ""}`}
                        onBlur={() => confirmingRemovalId === item.id && onConfirmRemoval(null)}
                        onClick={() => confirmingRemovalId === item.id ? void onDecide(item.id, "cancelled") : onConfirmRemoval(item.id)}
                        disabled={actionId === item.id}
                      >
                        <UserMinus size={14} aria-hidden="true" /> {confirmingRemovalId === item.id ? t("workspace.confirm") : t("workspace.endMentorship")}
                      </button>
                    </div>
                  ) : item.status === "accepted" && item.chatPeer ? (
                    <div><button type="button" className="workspace-message-button" onClick={() => onMessage(item.chatPeer!)}><MessageCircle size={14} aria-hidden="true" /> {t("workspace.message")}</button></div>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

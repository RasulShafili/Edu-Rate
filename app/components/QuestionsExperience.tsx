"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowBigUp, MessageCircleQuestion, Plus, RotateCcw, Send, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { formatDateWithMonths } from "../lib/date";
import { useAuth } from "./AuthProvider";

const TOPICS = ["kampus", "tedris", "yasayis", "texniki", "diger"] as const;

type Topic = (typeof TOPICS)[number];
type T = ReturnType<typeof useT>;

type Question = {
  id: string;
  title: string;
  body: string;
  topic: Topic;
  createdAt: string;
  voteCount: number;
  answerCount: number;
  voted: boolean;
  mine: boolean;
};

type Answer = { id: string; body: string; createdAt: string; mine: boolean };
type LoadState = "loading" | "ready" | "error";
type PendingDelete = { kind: "question"; id: string } | { kind: "answer"; questionId: string; answerId: string } | null;

/** Girişdən sonra istifadəçi suallara qayıtsın, profilə yox. */
const AUTH_HREF = "/auth?returnTo=%2Fquestions";

function topicKey(topic: string) {
  return `questions.topic.${(TOPICS as readonly string[]).includes(topic) ? topic : "diger"}`;
}

function relative(iso: string, t: T) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return t("questions.justNow");
  if (minutes < 60) return t("questions.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("questions.hoursAgo", { count: hours });
  // `Intl` "az-AZ" bəzi Chromium qurğularında ay adını vermir — ad lüğətdən gəlir.
  return formatDateWithMonths(iso, Array.from({ length: 12 }, (_, index) => t(`month.${index + 1}`)));
}

/**
 * Uğursuz sorğunun səbəbini tərcümə AÇARI kimi qaytarır (mətn yox — dil
 * dəyişəndə xəta köhnə dildə qalmasın). 401 ayrıca tutulur: sessiya bitəndə
 * interfeys istifadəçini hələ də daxil olmuş sayır, ona görə əvvəl hər klik
 * səssizcə geri qayıdırdı.
 */
function failureKey(status: number, fallbackKey: string) {
  if (status === 401) return "questions.sessionExpired";
  if (status === 403) return "questions.restricted";
  if (status === 404) return "questions.gone";
  if (status === 429) return "questions.rateLimited";
  return fallbackKey;
}

export function QuestionsExperience() {
  const { user, isAdmin } = useAuth();
  const t = useT();
  const reduceMotion = Boolean(useReducedMotion());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState<"new" | "top">("new");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", topic: "kampus" as Topic });
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [answersState, setAnswersState] = useState<Record<string, LoadState>>({});
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerSaving, setAnswerSaving] = useState(false);
  const [answerError, setAnswerError] = useState<{ questionId: string; key: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/questions?sort=${sort}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const payload = await response.json() as { data?: Question[] };
        if (!cancelled) {
          setQuestions(payload.data ?? []);
          setLoadState("ready");
        }
      } catch {
        // Əvvəl xəta "Hələ sual yoxdur" kimi göstərilirdi; sıralama dəyişəndə isə
        // köhnə siyahı yeni sıralamanın adı altında qalırdı.
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sort, reloadKey]);

  function reload() {
    setLoadState("loading");
    setReloadKey((value) => value + 1);
  }

  function dropQuestion(id: string) {
    setQuestions((current) => current.filter((item) => item.id !== id));
    if (openId === id) setOpenId(null);
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (draft.title.trim().length < 8) {
      setFormError("questions.titleTooShort");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: draft.title.trim(), body: draft.body.trim(), topic: draft.topic }),
      });
      if (!response.ok) {
        setFormError(failureKey(response.status, "questions.askFailed"));
        return;
      }
      setDraft({ title: "", body: "", topic: draft.topic });
      setFormOpen(false);
      // Sual saxlanılıb; siyahı yenilənməsi uğursuz olsa belə bunu "göndərilmədi" saymırıq.
      setReloadKey((value) => value + 1);
    } catch {
      setFormError("questions.askFailed");
    } finally {
      setSaving(false);
    }
  }

  async function vote(id: string) {
    if (!user) return;
    setActionError("");
    const flip = (item: Question) => item.id === id
      ? { ...item, voted: !item.voted, voteCount: item.voteCount + (item.voted ? -1 : 1) }
      : item;
    setQuestions((current) => current.map(flip));
    try {
      const response = await fetch(`/api/questions/${id}/vote`, { method: "POST" });
      if (response.ok) return;
      setQuestions((current) => current.map(flip));
      setActionError(failureKey(response.status, "questions.voteFailed"));
      if (response.status === 404) dropQuestion(id);
    } catch {
      setQuestions((current) => current.map(flip));
      setActionError("questions.voteFailed");
    }
  }

  async function loadAnswers(id: string) {
    setAnswersState((current) => ({ ...current, [id]: "loading" }));
    try {
      const response = await fetch(`/api/questions/${id}/answers`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const payload = await response.json() as { data?: Answer[] };
      setAnswers((current) => ({ ...current, [id]: payload.data ?? [] }));
      setAnswersState((current) => ({ ...current, [id]: "ready" }));
    } catch {
      // Əvvəl uğursuz yüklənmə "Hələ cavab yoxdur" yazırdı — cavabı olan sualda da.
      setAnswersState((current) => ({ ...current, [id]: "error" }));
    }
  }

  function toggleAnswers(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    setAnswerDraft("");
    setAnswerError(null);
    if (next && answersState[next] !== "ready") void loadAnswers(next);
  }

  async function answer(event: FormEvent, id: string) {
    event.preventDefault();
    const body = answerDraft.trim();
    if (body.length < 2 || answerSaving) return;
    setAnswerError(null);
    setAnswerSaving(true);
    try {
      const response = await fetch(`/api/questions/${id}/answers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        // Mətn yalnız uğurdan sonra silinir — əvvəl göndərməzdən qabaq silinirdi
        // və uğursuzluqda yazılan cavab itirdi.
        setAnswerError({ questionId: id, key: failureKey(response.status, "questions.answerFailed") });
        return;
      }
      const payload = await response.json().catch(() => null) as { data?: { id?: string } } | null;
      setAnswerDraft("");
      setAnswers((current) => ({
        ...current,
        [id]: [...(current[id] ?? []), { id: payload?.data?.id ?? `local-${Date.now()}`, body, createdAt: new Date().toISOString(), mine: true }],
      }));
      setQuestions((current) => current.map((item) => item.id === id ? { ...item, answerCount: item.answerCount + 1 } : item));
    } catch {
      setAnswerError({ questionId: id, key: "questions.answerFailed" });
    } finally {
      setAnswerSaving(false);
    }
  }

  async function removeQuestion(id: string) {
    setPendingDelete(null);
    setActionError("");
    const previous = questions;
    dropQuestion(id);
    try {
      const response = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      if (response.ok || response.status === 404) return;
      setQuestions(previous);
      setActionError(failureKey(response.status, "questions.deleteFailed"));
    } catch {
      setQuestions(previous);
      setActionError("questions.deleteFailed");
    }
  }

  async function removeAnswer(questionId: string, answerId: string) {
    setPendingDelete(null);
    setAnswerError(null);
    try {
      const response = await fetch(`/api/questions/${questionId}/answers/${answerId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        setAnswerError({ questionId, key: failureKey(response.status, "questions.deleteAnswerFailed") });
        return;
      }
      setAnswers((current) => ({ ...current, [questionId]: (current[questionId] ?? []).filter((item) => item.id !== answerId) }));
      setQuestions((current) => current.map((item) => item.id === questionId
        ? { ...item, answerCount: Math.max(0, item.answerCount - 1) }
        : item));
    } catch {
      setAnswerError({ questionId, key: "questions.deleteAnswerFailed" });
    }
  }

  return (
    <section className="questions-shell">
      <header className="section-heading">
        <div>
          <span>{t("questions.eyebrow")}</span>
          <h1 className="module-page-title">{t("questions.title")}</h1>
        </div>
        {user ? (
          <button type="button" className="kuds-primary-button" onClick={() => setFormOpen((value) => !value)} aria-expanded={formOpen}>
            <Plus size={16} /> {t("questions.ask")}
          </button>
        ) : (
          <Link href={AUTH_HREF} className="kuds-primary-button">{t("questions.signInToAsk")}</Link>
        )}
      </header>

      <p className="compare-lead">
        {t("questions.leadStart")}<strong>{t("questions.leadAnon")}</strong>{t("questions.leadEnd")}
      </p>

      <div className="questions-sort" role="group" aria-label={t("questions.sortLabel")}>
        <button type="button" className={sort === "new" ? "is-active" : ""} aria-pressed={sort === "new"} onClick={() => setSort("new")}>
          {t("questions.sortNew")}
        </button>
        <button type="button" className={sort === "top" ? "is-active" : ""} aria-pressed={sort === "top"} onClick={() => setSort("top")}>
          {t("questions.sortTop")}
        </button>
      </div>

      <AnimatePresence>
        {formOpen && user ? (
          <motion.form
            className="schedule-form"
            onSubmit={ask}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <label>
              {t("questions.fieldTitle")}
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                maxLength={180}
                placeholder={t("questions.titlePlaceholder")}
              />
            </label>
            <label>
              {t("questions.fieldBody")}
              <textarea
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                maxLength={1200}
                rows={3}
                placeholder={t("questions.bodyPlaceholder")}
              />
            </label>
            <div className="questions-topics" role="group" aria-label={t("questions.topicLabel")}>
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={draft.topic === topic ? "is-active" : ""}
                  onClick={() => setDraft({ ...draft, topic })}
                  aria-pressed={draft.topic === topic}
                >
                  {t(topicKey(topic))}
                </button>
              ))}
            </div>
            {formError ? <p className="form-error" role="alert">{t(formError)}</p> : null}
            <div className="schedule-form__actions">
              <button type="submit" className="kuds-primary-button" disabled={saving}>
                {saving ? t("questions.submitting") : t("questions.submit")}
              </button>
              <button type="button" onClick={() => { setFormOpen(false); setFormError(""); }}>{t("questions.cancel")}</button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* Səs və silmə xətaları formadan asılı olmadan görünür — əvvəl yalnız
          açıq formanın içində render olunurdu, forma bağlı olanda itirdi. */}
      <div aria-live="polite">
        {actionError ? (
          <p className="schedule-warning is-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {t(actionError)}
          </p>
        ) : null}
      </div>

      {loadState === "loading" ? <p className="chat-state">{t("questions.loading")}</p> : null}

      {loadState === "error" ? (
        <div className="schedule-empty" role="alert">
          <TriangleAlert size={28} />
          <h2>{t("questions.loadFailedTitle")}</h2>
          <p>{t("questions.loadFailedBody")}</p>
          <button type="button" className="kuds-primary-button" onClick={reload}>
            <RotateCcw size={16} aria-hidden="true" /> {t("questions.retry")}
          </button>
        </div>
      ) : null}

      {loadState === "ready" && questions.length ? (
        <ul className="questions-list">
          {questions.map((question) => {
            // Moderator (admin rolları) hər sualı silə bilir — backend bunu
            // həmişə qəbul edirdi, interfeys isə düyməni yalnız müəllifə göstərirdi (D6).
            const canDelete = question.mine || isAdmin;
            const answersId = `question-answers-${question.id}`;
            const panelState = answersState[question.id];
            const list = answers[question.id] ?? [];
            return (
              <li key={question.id} className="question-card">
                {user ? (
                  <button
                    type="button"
                    className={`question-vote${question.voted ? " is-voted" : ""}`}
                    onClick={() => void vote(question.id)}
                    aria-pressed={question.voted}
                    aria-label={t(question.voted ? "questions.voteRemove" : "questions.voteAdd", { count: question.voteCount })}
                  >
                    <ArrowBigUp size={17} aria-hidden="true" />
                    <b>{question.voteCount}</b>
                  </button>
                ) : (
                  <Link
                    href={AUTH_HREF}
                    className="question-vote"
                    aria-label={t("questions.voteSignIn", { count: question.voteCount })}
                    title={t("questions.voteSignIn", { count: question.voteCount })}
                  >
                    <ArrowBigUp size={17} aria-hidden="true" />
                    <b>{question.voteCount}</b>
                  </Link>
                )}
                <div className="question-body">
                  <div className="question-meta">
                    <span className="question-topic">{t(topicKey(question.topic))}</span>
                    <small>{relative(question.createdAt, t)}</small>
                    {question.mine ? <em>{t("questions.mine")}</em> : null}
                  </div>
                  <h2>{question.title}</h2>
                  {question.body ? <p>{question.body}</p> : null}

                  {pendingDelete?.kind === "question" && pendingDelete.id === question.id ? (
                    <div className="question-confirm" role="group">
                      <p>{t(question.mine ? "questions.deleteConfirmOwn" : "questions.deleteConfirmModerator")}</p>
                      <div>
                        <button type="button" className="is-danger" onClick={() => void removeQuestion(question.id)}>
                          {t("questions.deleteYes")}
                        </button>
                        <button type="button" onClick={() => setPendingDelete(null)}>{t("questions.deleteNo")}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="question-actions">
                      <button
                        type="button"
                        onClick={() => toggleAnswers(question.id)}
                        aria-expanded={openId === question.id}
                        aria-controls={answersId}
                      >
                        <MessageCircleQuestion size={14} aria-hidden="true" />
                        {question.answerCount ? t("questions.answerCount", { count: question.answerCount }) : t("questions.writeAnswer")}
                      </button>
                      {canDelete ? (
                        <button type="button" className="is-danger" onClick={() => setPendingDelete({ kind: "question", id: question.id })}>
                          <Trash2 size={13} aria-hidden="true" /> {t("questions.delete")}
                        </button>
                      ) : null}
                    </div>
                  )}

                  <AnimatePresence>
                    {openId === question.id ? (
                      <motion.div
                        id={answersId}
                        className="question-answers"
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {panelState === "loading" || panelState === undefined ? (
                          <p className="week-day__empty">{t("questions.answersLoading")}</p>
                        ) : null}
                        {panelState === "error" ? (
                          <p className="schedule-warning is-error" role="alert">
                            <TriangleAlert size={14} aria-hidden="true" /> {t("questions.answersFailed")}
                            <button type="button" className="question-inline-retry" onClick={() => void loadAnswers(question.id)}>
                              {t("questions.retry")}
                            </button>
                          </p>
                        ) : null}
                        {panelState === "ready" ? list.map((item) => {
                          const confirming = pendingDelete?.kind === "answer" && pendingDelete.answerId === item.id;
                          return (
                            <div key={item.id} className="question-answer">
                              <p>{item.body}</p>
                              <div className="question-answer__meta">
                                <small>{relative(item.createdAt, t)}{item.mine ? ` · ${t("questions.yourAnswer")}` : ""}</small>
                                {(item.mine || isAdmin) && !confirming ? (
                                  <button
                                    type="button"
                                    className="question-answer__delete"
                                    onClick={() => setPendingDelete({ kind: "answer", questionId: question.id, answerId: item.id })}
                                    aria-label={t("questions.deleteAnswer")}
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                  </button>
                                ) : null}
                              </div>
                              {confirming ? (
                                <div className="question-confirm" role="group">
                                  <p>{t("questions.deleteAnswerConfirm")}</p>
                                  <div>
                                    <button type="button" className="is-danger" onClick={() => void removeAnswer(question.id, item.id)}>
                                      {t("questions.deleteYes")}
                                    </button>
                                    <button type="button" onClick={() => setPendingDelete(null)}>{t("questions.deleteNo")}</button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        }) : null}
                        {panelState === "ready" && list.length === 0 ? (
                          <p className="week-day__empty">{t("questions.noAnswers")}</p>
                        ) : null}
                        <div aria-live="polite">
                          {answerError?.questionId === question.id ? (
                            <p className="schedule-warning is-error" role="alert">
                              <TriangleAlert size={14} aria-hidden="true" /> {t(answerError.key)}
                            </p>
                          ) : null}
                        </div>
                        {user ? (
                          <form className="question-answer-form" onSubmit={(event) => void answer(event, question.id)}>
                            <input
                              value={answerDraft}
                              onChange={(event) => setAnswerDraft(event.target.value)}
                              maxLength={1200}
                              placeholder={t("questions.answerPlaceholder")}
                              aria-label={t("questions.answerLabel")}
                            />
                            <button
                              type="submit"
                              disabled={answerDraft.trim().length < 2 || answerSaving}
                              aria-label={t("questions.sendAnswer")}
                            >
                              <Send size={15} aria-hidden="true" />
                            </button>
                          </form>
                        ) : (
                          <Link href={AUTH_HREF} className="welcome-secondary">{t("questions.signInToAnswer")}</Link>
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {loadState === "ready" && !questions.length ? (
        <div className="schedule-empty">
          <MessageCircleQuestion size={28} />
          <h2>{t("questions.emptyTitle")}</h2>
          <p>{t("questions.emptyBody")}</p>
        </div>
      ) : null}
    </section>
  );
}

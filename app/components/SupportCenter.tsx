"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, LifeBuoy, RotateCcw, Send, TriangleAlert } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useT } from "../i18n/LanguageProvider";
import { formatDateWithMonths } from "../lib/date";
import { useAuth } from "./AuthProvider";

type TicketFields = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketHistoryItem = { id: string; reference: string; topic: string; status: TicketStatus; createdAt: string };
type HistoryState = "loading" | "ready" | "error";

const initialFields: TicketFields = { name: "", email: "", topic: "", message: "" };
const ease = [0.22, 1, 0.36, 1] as const;
const MESSAGE_MAX = 2000;

// Dəyər serverə olduğu kimi gedir (admin paneli onu oxuyur); görünən ad tərcümədir.
const TOPICS = [
  { value: "Mentorluq", key: "support.topic.mentorship" },
  { value: "Tədbirlər və qeydiyyat", key: "support.topic.events" },
  { value: "İcma və söhbət", key: "support.topic.community" },
  { value: "Hesab dəstəyi", key: "support.topic.account" },
  { value: "Digər məsələ", key: "support.topic.other" },
] as const;

/**
 * Əvvəlki FAQ platformanın etmədiyi şeyləri vəd edirdi: "hər mentorluq
 * müraciətini icma nümayəndəsi nəzərdən keçirir" (müraciət birbaşa mentora
 * gedir), "tədbir qeydiyyatını dəyişmək üçün bizə yaz, yerini başqasına
 * keçirərik" (qeydiyyatı istifadəçi özü geri çəkir, ötürmə yoxdur).
 */
const FAQS = ["mentor", "response", "events", "safety"] as const;

function topicLabel(value: string, t: ReturnType<typeof useT>) {
  const topic = TOPICS.find((item) => item.value === value);
  return topic ? t(topic.key) : value;
}

function getTicketValidity(fields: TicketFields, signedIn: boolean) {
  return {
    // Daxil olmuş istifadəçinin adı və e-poçtu hesabdan gəlir — backend onsuz da onları götürür.
    name: signedIn || fields.name.trim().length >= 2,
    email: signedIn || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()),
    topic: fields.topic.length > 0,
    message: fields.message.trim().length >= 20,
  };
}

function submitFailureKey(status: number) {
  if (status === 429) return "support.rateLimited";
  if (status === 422) return "support.invalid";
  return "support.submitFailed";
}

export function SupportCenter() {
  const { user } = useAuth();
  const t = useT();
  const [openFaq, setOpenFaq] = useState<string | null>(FAQS[0]);
  const [fields, setFields] = useState<TicketFields>(initialFields);
  const [touched, setTouched] = useState<Set<keyof TicketFields>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ reference: string; email: string; noteKey: string } | null>(null);
  const [submitErrorKey, setSubmitErrorKey] = useState("");
  const [tickets, setTickets] = useState<TicketHistoryItem[]>([]);
  const [historyState, setHistoryState] = useState<HistoryState>("loading");
  const [historyErrorKey, setHistoryErrorKey] = useState("");
  const reduceMotion = useReducedMotion();

  const signedIn = Boolean(user);
  const validity = getTicketValidity(fields, signedIn);
  const formValid = Object.values(validity).every(Boolean);
  const months = Array.from({ length: 12 }, (_, index) => t(`month.${index + 1}`));

  const loadHistory = useCallback(async () => {
    setHistoryState("loading");
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" });
      if (!response.ok) {
        // Əvvəl server xətası "Hesabınıza bağlı dəstək müraciəti yoxdur" kimi görünürdü.
        setHistoryErrorKey(response.status === 401 ? "support.sessionExpired" : "support.historyFailed");
        setHistoryState("error");
        return;
      }
      const payload = await response.json() as { data?: TicketHistoryItem[] };
      setTickets(payload.data ?? []);
      setHistoryState("ready");
    } catch {
      setHistoryErrorKey("support.historyFailed");
      setHistoryState("error");
    }
  }, []);

  // Tarixçə istifadəçiyə bağlıdır: sessiya sonradan bərpa olunanda da yenidən
  // yüklənir. Əvvəl "daxil ol" vəziyyəti bir dəfə qoyulub heç sıfırlanmırdı.
  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setTimeout(() => void loadHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [signedIn, loadHistory]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const name = event.target.name as keyof TicketFields;
    setFields((current) => ({ ...current, [name]: event.target.value }));
  }

  function touchField(name: keyof TicketFields) {
    setTouched((current) => new Set(current).add(name));
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formValid || submitting) {
      setTouched(new Set(["name", "email", "topic", "message"]));
      return;
    }
    setSubmitting(true);
    setSubmitErrorKey("");
    // Daxil olmuş istifadəçi üçün backend ad və e-poçtu hesabdan götürür. Əvvəl
    // forma onları yenə soruşurdu və uğur mesajı YAZILAN e-poçtu vəd edirdi,
    // halbuki cavab hesab e-poçtuna gedəcəkdi.
    const contact = user ? { name: user.name, email: user.email } : { name: fields.name, email: fields.email };
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...contact, topic: fields.topic, message: fields.message }),
      });
      if (!response.ok) {
        setSubmitErrorKey(submitFailureKey(response.status));
        return;
      }
      const payload = await response.json().catch(() => null) as { data?: { reference?: string; linked?: boolean } } | null;
      const linked = Boolean(user) && payload?.data?.linked !== false;
      setSubmitted({
        reference: payload?.data?.reference ?? "",
        email: contact.email.trim(),
        // Daxil olmuş görünən, amma sessiyası bitmiş istifadəçinin müraciəti hesaba bağlanmır.
        noteKey: linked ? "support.successTrack" : user ? "support.successUnlinked" : "support.successAnon",
      });
      if (linked) void loadHistory();
    } catch {
      setSubmitErrorKey("support.submitFailed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetTicket() {
    setFields(initialFields);
    setTouched(new Set());
    setSubmitted(null);
    setSubmitErrorKey("");
  }

  const showError = (name: keyof TicketFields) => touched.has(name) && !validity[name];

  return (
    <section id="support" className="support-section route-module-section" aria-labelledby="support-title">
      <motion.div
        className="support-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease }}
      >
        <div>
          <span className="support-kicker">{t("support.eyebrow")}</span>
          <h1 id="support-title" className="module-page-title">{t("support.title")}</h1>
        </div>
      </motion.div>

      <div className="support-layout">
        <motion.div
          className="faq-panel"
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
        >
          <div className="support-panel-label">
            <span>{t("support.faqTitle")}</span>
            <small>{t("support.faqCount", { count: FAQS.length })}</small>
          </div>

          <div className="faq-list">
            {FAQS.map((id, index) => {
              const open = openFaq === id;
              const answerId = `faq-answer-${id}`;
              return (
                <div className={`faq-item${open ? " is-open" : ""}`} key={id}>
                  {/* h2: h1-dən sonra birbaşa h3 gəlirdi (başlıq sırası pozulurdu). */}
                  <h2>
                    <button
                      id={`faq-trigger-${id}`}
                      type="button"
                      onClick={() => setOpenFaq(open ? null : id)}
                      aria-expanded={open}
                      aria-controls={answerId}
                    >
                      <span className="faq-number">{String(index + 1).padStart(2, "0")}</span>
                      <strong>{t(`support.faq.${id}.q`)}</strong>
                      <motion.i animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease }}>
                        <ChevronDown size={16} aria-hidden="true" />
                      </motion.i>
                    </button>
                  </h2>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={answerId}
                        className="faq-answer"
                        role="region"
                        aria-labelledby={`faq-trigger-${id}`}
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.38, ease }}
                      >
                        <p>{t(`support.faq.${id}.a`)}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="faq-contact-note">
            <LifeBuoy size={17} aria-hidden="true" />
            <p><strong>{t("support.contactNoteTitle")}</strong> {t("support.contactNoteBody")}</p>
          </div>
        </motion.div>

        <motion.div
          className="ticket-panel"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.08, ease }}
        >
          <div className="ticket-progress-head">
            <div>
              <span>{t("support.formTitle")}</span>
              <small>{t("support.formHint")}</small>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {submitted ? (
              <motion.div
                key="success"
                className="ticket-success"
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
                role="status"
              >
                <motion.span
                  initial={reduceMotion ? false : { scale: 0, rotate: -18 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 330, damping: 18, delay: 0.12 }}
                >
                  <Check size={24} aria-hidden="true" />
                </motion.span>
                <small>{t("support.successKicker")}</small>
                <h3>{t("support.successTitle")}</h3>
                <p>
                  {t("support.successBody", { email: submitted.email })}{" "}
                  {t(submitted.noteKey)}
                </p>
                {submitted.reference ? <small>{t("support.reference", { code: submitted.reference })}</small> : null}
                <button type="button" onClick={resetTicket}>
                  {t("support.newRequest")} <ArrowRight size={14} aria-hidden="true" />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className="ticket-form"
                onSubmit={submitTicket}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              >
                {user ? (
                  <p className="ticket-account-note">{t("support.accountNote", { name: user.name, email: user.email })}</p>
                ) : (
                  <>
                    <div className={`floating-field${fields.name ? " has-value" : ""}${showError("name") ? " has-error" : ""}`}>
                      <input
                        id="ticket-name"
                        name="name"
                        type="text"
                        value={fields.name}
                        onChange={updateField}
                        onBlur={() => touchField("name")}
                        placeholder=" "
                        autoComplete="name"
                        minLength={2}
                        maxLength={120}
                        aria-invalid={showError("name")}
                        aria-describedby={showError("name") ? "ticket-name-error" : undefined}
                        required
                      />
                      <label htmlFor="ticket-name">{t("support.name")}</label>
                      {showError("name") && <small id="ticket-name-error" className="field-error">{t("support.nameError")}</small>}
                    </div>

                    <div className={`floating-field${fields.email ? " has-value" : ""}${showError("email") ? " has-error" : ""}`}>
                      <input
                        id="ticket-email"
                        name="email"
                        type="email"
                        value={fields.email}
                        onChange={updateField}
                        onBlur={() => touchField("email")}
                        placeholder=" "
                        autoComplete="email"
                        aria-invalid={showError("email")}
                        aria-describedby={showError("email") ? "ticket-email-error" : undefined}
                        required
                      />
                      <label htmlFor="ticket-email">{t("support.email")}</label>
                      {showError("email") && <small id="ticket-email-error" className="field-error">{t("support.emailError")}</small>}
                    </div>
                  </>
                )}

                <div className={`floating-field floating-select${fields.topic ? " has-value" : ""}${showError("topic") ? " has-error" : ""}`}>
                  <select
                    id="ticket-topic"
                    name="topic"
                    value={fields.topic}
                    onChange={updateField}
                    onBlur={() => touchField("topic")}
                    aria-invalid={showError("topic")}
                    aria-describedby={showError("topic") ? "ticket-topic-error" : undefined}
                    required
                  >
                    <option value="" disabled aria-label={t("support.topicPlaceholder")} />
                    {TOPICS.map((topic) => <option key={topic.value} value={topic.value}>{t(topic.key)}</option>)}
                  </select>
                  <label htmlFor="ticket-topic">{t("support.topic")}</label>
                  <ChevronDown size={15} aria-hidden="true" />
                  {showError("topic") && <small id="ticket-topic-error" className="field-error">{t("support.topicError")}</small>}
                </div>

                <div className={`floating-field floating-textarea${fields.message ? " has-value" : ""}${showError("message") ? " has-error" : ""}`}>
                  <textarea
                    id="ticket-message"
                    name="message"
                    value={fields.message}
                    onChange={updateField}
                    onBlur={() => touchField("message")}
                    placeholder=" "
                    rows={5}
                    minLength={20}
                    maxLength={MESSAGE_MAX}
                    aria-invalid={showError("message")}
                    aria-describedby={showError("message") ? "ticket-message-error" : "ticket-message-count"}
                    required
                  />
                  <label htmlFor="ticket-message">{t("support.message")}</label>
                  {showError("message") && <small id="ticket-message-error" className="field-error">{t("support.messageError")}</small>}
                </div>
                {/* Backend 2000 simvoldan uzun mətni rədd edirdi, forma isə limiti heç göstərmirdi. */}
                <small id="ticket-message-count" className="ticket-message-count">{fields.message.length} / {MESSAGE_MAX}</small>

                <div className="ticket-form-footer">
                  <span>{formValid ? t("support.ready") : t("support.incomplete")}</span>
                  <motion.button
                    type="submit"
                    disabled={submitting}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  >
                    {submitting ? <i className="ticket-spinner" /> : <Send size={14} aria-hidden="true" />}
                    {submitting ? t("support.submitting") : t("support.submit")}
                  </motion.button>
                </div>
                {submitErrorKey ? (
                  <p className="schedule-warning is-error" role="alert">
                    <TriangleAlert size={14} aria-hidden="true" /> {t(submitErrorKey)}
                  </p>
                ) : null}
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <section className="ticket-history" aria-labelledby="ticket-history-title">
        <header>
          <span>{t("support.historyEyebrow")}</span>
          <h2 id="ticket-history-title">{t("support.historyTitle")}</h2>
        </header>
        {!user ? (
          <p className="ticket-history__empty">
            {t("support.historySignIn")}{" "}
            <Link href="/auth?returnTo=%2Fsupport" className="ticket-history__link">{t("support.historySignInCta")}</Link>
          </p>
        ) : historyState === "loading" ? (
          <div className="ticket-history__loading" aria-label={t("support.historyLoading")}><i /><i /></div>
        ) : historyState === "error" ? (
          <p className="schedule-warning is-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {t(historyErrorKey)}
            <button type="button" className="question-inline-retry" onClick={() => void loadHistory()}>
              <RotateCcw size={13} aria-hidden="true" /> {t("support.retry")}
            </button>
          </p>
        ) : tickets.length === 0 ? (
          <p className="ticket-history__empty">{t("support.historyEmpty")}</p>
        ) : (
          <div className="ticket-history__list">
            {tickets.map((ticket) => (
              <article key={ticket.id}>
                <div>
                  <small>{ticket.reference} · {formatDateWithMonths(ticket.createdAt, months)}</small>
                  <strong>{topicLabel(ticket.topic, t)}</strong>
                </div>
                <span className={`is-${ticket.status}`}>{t(`support.status.${ticket.status}`)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

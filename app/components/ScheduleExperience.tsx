"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { useT } from "../i18n/LanguageProvider";

const TONES = ["mint", "lilac", "blue", "coral", "gold", "sage"] as const;
type Tone = (typeof TONES)[number];

/**
 * Backend `dayOfWeek` üçün 1–7 qəbul edir (bazadakı CHECK də belədir), amma
 * cədvəl əvvəl yalnız 6 sütun göstərirdi. Nəticədə bazar günü üçün yaradılmış
 * qeyd heç yerdə görünmürdü. Ona görə burada da 7 gün var.
 */
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

type Entry = {
  id: string;
  subject: string;
  teacher: string;
  room: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  tone: Tone;
};

type CampusEvent = { id: string; title: string; startAt: string; location?: string };

type Draft = {
  subject: string;
  teacher: string;
  room: string;
  dayOfWeek: number;
  start: string;
  end: string;
  tone: Tone;
};

const emptyDraft: Draft = {
  subject: "",
  teacher: "",
  room: "",
  dayOfWeek: 1,
  start: "09:00",
  end: "10:30",
  tone: "mint",
};

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toClock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** ISO tarixdən yerli saat — `Intl` olmadan, çünki nəticə hər brauzerdə eyni olmalıdır. */
function clockOf(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** JS-də bazar 0-dır; bizdə isə həftənin 7-ci günü. */
function isoDay(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function ScheduleExperience() {
  const { user } = useAuth();
  const t = useT();
  const reduceMotion = Boolean(useReducedMotion());

  const [entries, setEntries] = useState<Entry[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState("");
  /** Formadan kənar əməliyyatların (silmə) xətası — forma bağlı olanda da görünməlidir. */
  const [listError, setListError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Tarix yalnız brauzerdə hesablanır.
   *
   * Əvvəl `useState(() => new Date())` idi: server öz saatı və öz ICU-su ilə,
   * brauzer isə öz saatı ilə render edirdi. Nəticədə hidrasiya uyğunsuzluğu
   * çıxırdı, üstəlik serverin UTC-si ilə Bakının UTC+4-ü axşam saatlarında
   * fərqli gün göstərirdi. `null` başlanğıc hər iki tərəfdə eyni markup verir.
   */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // setState effektin içində birbaşa yox, taymerdə — lint qaydası (set-state-in-effect).
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      setLoadFailed(false);
      try {
        const response = await fetch("/api/timetable", { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { data?: Entry[] } | null;
        if (cancelled) return;
        // Xəta artıq sakit udulmur: boş cədvəl göstərmək istifadəçiyə
        // qeydlərinin silindiyini düşündürürdü.
        if (!response.ok || !payload?.data) setLoadFailed(true);
        else setEntries(payload.data);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/catalog/events", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload: { data?: CampusEvent[] }) => {
        if (!cancelled) setEvents(payload.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const today = now ? isoDay(now) : 0;
  const minuteNow = now ? now.getHours() * 60 + now.getMinutes() : 0;

  const dateLine = now
    ? t("schedule.dateLine", {
        day: now.getDate(),
        month: t(`month.${now.getMonth() + 1}`),
        weekday: t(`schedule.day.${isoDay(now)}`),
      })
    : "";

  const todayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.dayOfWeek === today)
        .sort((a, b) => a.startMinute - b.startMinute),
    [entries, today],
  );

  const nextEntry = useMemo(
    () => todayEntries.find((entry) => entry.endMinute > minuteNow),
    [todayEntries, minuteNow],
  );

  const todayEvents = useMemo(() => {
    if (!now) return [];
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return events
      .filter((item) => {
        const at = new Date(item.startAt).getTime();
        return at >= start.getTime() && at < end.getTime();
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events, now]);

  /**
   * Eyni gündə vaxtı kəsişən dərs — bloklamırıq (istifadəçi bilərəkdən yaza
   * bilər), amma xəbərdarlıq edirik: eyni anda iki auditoriyada olmaq mümkün deyil.
   */
  const overlapping = useMemo(() => {
    const start = toMinutes(draft.start);
    const end = toMinutes(draft.end);
    if (end <= start) return null;
    return (
      entries.find(
        (entry) =>
          entry.id !== editingId &&
          entry.dayOfWeek === draft.dayOfWeek &&
          entry.startMinute < end &&
          start < entry.endMinute,
      ) ?? null
    );
  }, [entries, draft, editingId]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError("");
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((entry: Entry) => {
    setEditingId(entry.id);
    setPendingDelete(null);
    setFormError("");
    setDraft({
      subject: entry.subject,
      teacher: entry.teacher,
      room: entry.room,
      dayOfWeek: entry.dayOfWeek,
      start: toClock(entry.startMinute),
      end: toClock(entry.endMinute),
      tone: entry.tone,
    });
    setFormOpen(true);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const startMinute = toMinutes(draft.start);
    const endMinute = toMinutes(draft.end);
    if (draft.subject.trim().length < 2) {
      setFormError(t("schedule.subjectRequired"));
      return;
    }
    if (endMinute <= startMinute) {
      setFormError(t("schedule.timeOrder"));
      return;
    }
    setSaving(true);
    const body = {
      subject: draft.subject.trim(),
      teacher: draft.teacher.trim(),
      room: draft.room.trim(),
      dayOfWeek: draft.dayOfWeek,
      startMinute,
      endMinute,
      tone: draft.tone,
    };
    try {
      const response = await fetch(
        editingId ? `/api/timetable/${encodeURIComponent(editingId)}` : "/api/timetable",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { data?: Entry; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error?.message ?? t(editingId ? "schedule.updateFailed" : "schedule.saveFailed"),
        );
      }
      const saved = payload.data;
      setEntries((current) =>
        editingId ? current.map((item) => (item.id === saved.id ? saved : item)) : [...current, saved],
      );
      setDraft({ ...emptyDraft, dayOfWeek: draft.dayOfWeek });
      setFormOpen(false);
      setEditingId(null);
    } catch (cause) {
      setFormError(
        cause instanceof Error
          ? cause.message
          : t(editingId ? "schedule.updateFailed" : "schedule.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const previous = entries;
    setPendingDelete(null);
    setListError("");
    setEntries((current) => current.filter((item) => item.id !== id));
    if (editingId === id) closeForm();
    try {
      const response = await fetch(`/api/timetable/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    } catch {
      // Geri qaytarılan dərs izahsız yenidən peyda olurdu — indi səbəb yazılır.
      setEntries(previous);
      setListError(t("schedule.deleteFailed"));
    }
  }

  if (!user) {
    return (
      <section className="schedule-shell">
        <header className="section-heading">
          <div>
            <span>{t("schedule.eyebrow")}</span>
            <h1 className="module-page-title">{t("schedule.title")}</h1>
          </div>
        </header>
        <div className="schedule-empty">
          <CalendarDays size={30} />
          <h2>{t("schedule.signedOutTitle")}</h2>
          <p>{t("schedule.signedOutBody")}</p>
          {/* `returnTo` olmasa istifadəçi girişdən sonra cədvələ yox, profilə düşürdü. */}
          <Link href="/auth?returnTo=%2Fschedule" className="kuds-primary-button">
            {t("schedule.signIn")}
          </Link>
        </div>
      </section>
    );
  }

  const showWeek = !loading && !loadFailed && entries.length > 0;
  const showEmpty = !loading && !loadFailed && entries.length === 0;

  return (
    <section className="schedule-shell">
      <header className="section-heading">
        <div>
          <span>{t("schedule.eyebrow")}</span>
          <h1 className="module-page-title">{t("schedule.title")}</h1>
        </div>
        <button
          type="button"
          className="kuds-primary-button"
          aria-expanded={formOpen}
          onClick={() => (formOpen ? closeForm() : openCreate())}
        >
          <Plus size={16} aria-hidden="true" /> {t("schedule.add")}
        </button>
      </header>

      <div className="today-panel">
        <div className="today-panel__head">
          <Sparkles size={16} aria-hidden="true" />
          <h2>{t("schedule.todayPanel")}</h2>
          <small>{dateLine}</small>
        </div>

        {nextEntry ? (
          <div className={`today-next tone-${nextEntry.tone}`}>
            <span className="today-next__label">
              {nextEntry.startMinute <= minuteNow ? t("schedule.ongoing") : t("schedule.nextLesson")}
            </span>
            <strong>{nextEntry.subject}</strong>
            <p>
              <span>
                <Clock size={13} aria-hidden="true" /> {toClock(nextEntry.startMinute)}–
                {toClock(nextEntry.endMinute)}
              </span>
              {nextEntry.room ? (
                <span>
                  <MapPin size={13} aria-hidden="true" /> {nextEntry.room}
                </span>
              ) : null}
              {nextEntry.teacher ? (
                <span>
                  <User size={13} aria-hidden="true" /> {nextEntry.teacher}
                </span>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="today-none">
            {todayEntries.length ? t("schedule.finishedToday") : t("schedule.noneToday")}
          </p>
        )}

        {todayEvents.length ? (
          <ul className="today-events">
            {todayEvents.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span>{clockOf(item.startAt)}</span>
                <strong>{item.title}</strong>
                {item.location ? <small>{item.location}</small> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <AnimatePresence>
        {formOpen ? (
          <motion.form
            className="schedule-form"
            onSubmit={submit}
            aria-label={t(editingId ? "schedule.editTitle" : "schedule.newTitle")}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="schedule-form__grid">
              <label>
                {t("schedule.subject")}
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                  maxLength={120}
                  placeholder={t("schedule.subjectPlaceholder")}
                />
              </label>
              <label>
                {t("schedule.teacher")}
                <input
                  value={draft.teacher}
                  onChange={(event) => setDraft({ ...draft, teacher: event.target.value })}
                  maxLength={120}
                  placeholder={t("schedule.teacherPlaceholder")}
                />
              </label>
              <label>
                {t("schedule.room")}
                <input
                  value={draft.room}
                  onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                  maxLength={80}
                  placeholder={t("schedule.roomPlaceholder")}
                />
              </label>
              <label>
                {t("schedule.day")}
                <select
                  value={draft.dayOfWeek}
                  onChange={(event) => setDraft({ ...draft, dayOfWeek: Number(event.target.value) })}
                >
                  {DAY_VALUES.map((day) => (
                    <option key={day} value={day}>
                      {t(`schedule.day.${day}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("schedule.start")}
                <input
                  type="time"
                  value={draft.start}
                  onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                />
              </label>
              <label>
                {t("schedule.end")}
                <input
                  type="time"
                  value={draft.end}
                  onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                />
              </label>
            </div>

            <div className="schedule-form__tones" role="group" aria-label={t("schedule.color")}>
              {TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`tone-chip tone-${tone}${draft.tone === tone ? " is-active" : ""}`}
                  onClick={() => setDraft({ ...draft, tone })}
                  // Əvvəl burada "lilac rəngi" kimi ingilis adlar oxunurdu.
                  aria-label={t(`schedule.tone.${tone}`)}
                  aria-pressed={draft.tone === tone}
                />
              ))}
            </div>

            {overlapping ? (
              <p className="schedule-warning">
                <TriangleAlert size={14} aria-hidden="true" />
                {t("schedule.overlap", { subject: overlapping.subject })}
              </p>
            ) : null}
            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}

            <div className="schedule-form__actions">
              <button type="submit" className="kuds-primary-button" disabled={saving}>
                {saving
                  ? t(editingId ? "schedule.updating" : "schedule.saving")
                  : t(editingId ? "schedule.update" : "schedule.save")}
              </button>
              <button type="button" onClick={closeForm}>
                {t("schedule.cancel")}
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      {/* Silmə xətası formadan asılı olmadan görünür. */}
      <div aria-live="polite">
        {listError ? (
          <p className="schedule-warning is-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" />
            {listError}
          </p>
        ) : null}
      </div>

      {loading ? <p className="chat-state">{t("schedule.loading")}</p> : null}

      {loadFailed ? (
        <div className="schedule-empty" role="alert">
          <TriangleAlert size={28} />
          <h2>{t("schedule.loadFailedTitle")}</h2>
          <p>{t("schedule.loadFailedBody")}</p>
          <button
            type="button"
            className="kuds-primary-button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RotateCcw size={16} aria-hidden="true" /> {t("schedule.retry")}
          </button>
        </div>
      ) : null}

      {showWeek ? (
        <div className="week-grid">
          {DAY_VALUES.map((day) => {
            const dayEntries = entries
              .filter((entry) => entry.dayOfWeek === day)
              .sort((a, b) => a.startMinute - b.startMinute);
            return (
              <div key={day} className={`week-day${day === today ? " is-today" : ""}`}>
                <header>
                  <strong>{t(`schedule.dayShort.${day}`)}</strong>
                  <span>{t(`schedule.day.${day}`)}</span>
                </header>
                {dayEntries.length ? (
                  <ul>
                    {dayEntries.map((entry) => (
                      <li key={entry.id} className={`lesson tone-${entry.tone}`}>
                        <div className="lesson__body">
                          <strong>{entry.subject}</strong>
                          <small>
                            {toClock(entry.startMinute)}–{toClock(entry.endMinute)}
                            {entry.room ? ` · ${entry.room}` : ""}
                          </small>
                          {entry.teacher ? <em>{entry.teacher}</em> : null}
                        </div>
                        {pendingDelete === entry.id ? (
                          <div className="lesson__confirm">
                            <p>{t("schedule.deleteConfirm", { subject: entry.subject })}</p>
                            <div>
                              <button type="button" onClick={() => void remove(entry.id)}>
                                {t("schedule.deleteYes")}
                              </button>
                              <button type="button" onClick={() => setPendingDelete(null)}>
                                {t("schedule.deleteNo")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="lesson__tools">
                            <button
                              type="button"
                              onClick={() => openEdit(entry)}
                              aria-label={t("schedule.edit", { subject: entry.subject })}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(entry.id)}
                              aria-label={t("schedule.delete", { subject: entry.subject })}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="week-day__empty">{t("schedule.noLesson")}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="schedule-empty">
          <CalendarDays size={28} />
          <h2>{t("schedule.emptyTitle")}</h2>
          <p>{t("schedule.emptyBody")}</p>
          <button type="button" className="kuds-primary-button" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" /> {t("schedule.addFirst")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

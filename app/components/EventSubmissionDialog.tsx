"use client";

import { CalendarPlus, CheckCircle2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { ApiEvent, EventCategory } from "../data/events";
import { useT } from "../i18n/LanguageProvider";
import { adminErrorKeyFor } from "../lib/admin-errors";
import { uploadSecureImage } from "../lib/media-upload";
import { ImageDraftPicker } from "./ImageDraftPicker";
import { BodyPortal } from "./ui/BodyPortal";

/** Yaradanın öz tədbiri (GET /api/events/mine) — redaktə üçün. */
export type EditableEvent = {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  longDescription: string;
  location: string;
  city: string;
  organizer: string;
  startAt: string;
  endAt: string;
  registrationDeadline: string;
  speakers: string[];
  capacity: number;
  registered?: number;
};

type Props = { open: boolean; onClose: () => void; onCreated: () => void; organizerName: string; publishesDirectly: boolean; editing?: EditableEvent | null };

const categories: readonly EventCategory[] = ["Technology", "Design", "Culture", "Wellness"];

const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const fromEvent = (event: EditableEvent) => ({
  title: event.title, category: event.category, description: event.description, longDescription: event.longDescription,
  location: event.location, city: event.city, organizer: event.organizer,
  startAt: local(new Date(event.startAt)), endAt: local(new Date(event.endAt)), registrationDeadline: local(new Date(event.registrationDeadline)),
  speakers: event.speakers.join(", "), capacity: String(event.capacity),
});

const initial = (organizer = "") => {
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  start.setHours(15, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const deadline = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  return { title: "", category: "Technology" as EventCategory, description: "", longDescription: "", location: "", city: "Xankəndi", organizer, startAt: local(start), endAt: local(end), registrationDeadline: local(deadline), speakers: "", capacity: "50" };
};

/** Nəticə mətn yox, açar kimi saxlanır ki, dil dəyişəndə də düzgün görünsün. */
type Outcome = { key: string; imageFailed: boolean };

export function EventSubmissionDialog({ open, onClose, onCreated, organizerName, publishesDirectly, editing = null }: Props) {
  const t = useT();
  const [draft, setDraft] = useState(() => initial());
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setDraft((current) => editing ? fromEvent(editing) : ({ ...current, organizer: current.organizer || organizerName })), 0);
    return () => window.clearTimeout(timer);
  }, [open, organizerName, editing]);

  if (!open) return null;

  // Dialoq həmişə quraşdırılmış qalır. Əvvəl bağlananda uğur vəziyyəti sıfırlanmırdı:
  // ikinci tədbiri yaratmaq istəyən yenidən "Tamamlandı" ekranını görürdü.
  function close() {
    if (busy) return;
    setSuccess(null);
    setError("");
    if (editing) setDraft(initial(organizerName));
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const start = new Date(draft.startAt).getTime();
    // Backend eyni qaydaları yoxlayır, amma mesajı yalnız azərbaycanca qaytarır.
    if (new Date(draft.endAt).getTime() <= start) {
      setError("eventForm.error.endBeforeStart");
      return;
    }
    if (new Date(draft.registrationDeadline).getTime() > start) {
      setError("eventForm.error.deadlineAfterStart");
      return;
    }
    setBusy(true);
    try {
      const fields = {
        ...draft,
        startAt: new Date(draft.startAt).toISOString(),
        endAt: new Date(draft.endAt).toISOString(),
        registrationDeadline: new Date(draft.registrationDeadline).toISOString(),
        speakers: draft.speakers.split(",").map((value) => value.trim()).filter(Boolean),
        capacity: Number(draft.capacity),
      };
      const response = await fetch(editing ? `/api/events/${encodeURIComponent(editing.id)}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? fields : { ...fields, accent: "#44766c", glow: "rgba(68,118,108,.28)" }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: ApiEvent; error?: { code?: string } } | null;
      if (!response.ok || !payload?.data) {
        const fallback = editing ? "eventForm.error.update" : "eventForm.error.create";
        setError(payload?.error?.code === "CAPACITY_BELOW_REGISTRATIONS" ? "eventForm.error.capacityBelow" : adminErrorKeyFor(response.status, payload?.error?.code, fallback));
        return;
      }
      let imageFailed = false;
      if (image) {
        try {
          await uploadSecureImage(image, "event", payload.data.id);
        } catch {
          imageFailed = true;
        }
      }
      setSuccess({ key: editing ? (publishesDirectly ? "eventForm.updated" : "eventForm.updatedReview") : publishesDirectly ? "eventForm.published" : "eventForm.sentForReview", imageFailed });
      setImage(null);
      setDraft(initial(organizerName));
      onCreated();
    } catch {
      setError(editing ? "eventForm.error.update" : "eventForm.error.create");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof draft) => ({
    value: draft[key],
    onChange: (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value }),
  });

  return (
    <BodyPortal>
    <div className="content-submission-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="content-submission-dialog is-event" role="dialog" aria-modal="true" aria-labelledby="event-submission-title">
        <header>
          <div>
            <small>{t("eventForm.eyebrow")}</small>
            <h2 id="event-submission-title">{t(editing ? "eventForm.editTitle" : "eventForm.title")}</h2>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label={t("common.close")}><X size={19} aria-hidden="true" /></button>
        </header>
        {success ? (
          <div className="content-submission-success">
            <CheckCircle2 size={36} aria-hidden="true" />
            <h3>{t("eventForm.done")}</h3>
            <p>{t(success.key)}{success.imageFailed ? ` ${t("eventForm.imageFailed")}` : ""}</p>
            <button type="button" onClick={close}>{t("common.close")}</button>
          </div>
        ) : (
          <form method="post" onSubmit={submit}>
            <div className="content-submission-note">
              <CalendarPlus size={18} aria-hidden="true" />
              <p>{t(editing ? (publishesDirectly ? "eventForm.editNoteDirect" : "eventForm.editNoteReview") : publishesDirectly ? "eventForm.noteDirect" : "eventForm.noteReview")}</p>
            </div>
            <ImageDraftPicker file={image} onChange={setImage} label={t("eventForm.image")} />
            <div className="content-submission-grid">
              <label className="is-wide"><span>{t("eventForm.name")}</span><input {...field("title")} minLength={3} maxLength={140} required autoFocus /></label>
              <label><span>{t("eventForm.category")}</span>
                <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as EventCategory })}>
                  {categories.map((category) => <option key={category} value={category}>{t(`eventCategory.${category}`)}</option>)}
                </select>
              </label>
              <label><span>{t("eventForm.capacity")}</span><input type="number" min={Math.max(1, editing?.registered ?? 1)} max="10000" {...field("capacity")} required /></label>
              <label className="is-wide"><span>{t("eventForm.description")}</span><input {...field("description")} minLength={10} maxLength={280} required /></label>
              <label className="is-wide"><span>{t("eventForm.longDescription")}</span><textarea {...field("longDescription")} minLength={20} maxLength={1600} rows={4} required /></label>
              <label><span>{t("eventForm.organizer")}</span><input {...field("organizer")} minLength={2} maxLength={180} required /></label>
              <label><span>{t("eventForm.speakers")}</span><input {...field("speakers")} placeholder={t("eventForm.speakersHint")} /></label>
              <label><span>{t("eventForm.location")}</span><input {...field("location")} minLength={2} maxLength={180} required /></label>
              <label><span>{t("eventForm.city")}</span><input {...field("city")} minLength={2} maxLength={120} required /></label>
              <label><span>{t("eventForm.startAt")}</span><input type="datetime-local" {...field("startAt")} required /></label>
              <label><span>{t("eventForm.endAt")}</span><input type="datetime-local" {...field("endAt")} required /></label>
              <label className="is-wide"><span>{t("eventForm.deadline")}</span><input type="datetime-local" {...field("registrationDeadline")} required /></label>
            </div>
            <div aria-live="polite">{error ? <p className="content-submission-error" role="alert">{t(error)}</p> : null}</div>
            <footer>
              <button type="button" onClick={close} disabled={busy}>{t("common.cancel")}</button>
              <button type="submit" disabled={busy}>{busy ? t("eventForm.sending") : t(editing ? "eventForm.save" : publishesDirectly ? "eventForm.publish" : "eventForm.submitReview")}</button>
            </footer>
          </form>
        )}
      </section>
    </div>
    </BodyPortal>
  );
}

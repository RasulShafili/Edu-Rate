"use client";

import { Check, FileText, Flag, Inbox, Megaphone, Plus, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { adminErrorKeyFor } from "../lib/admin-errors";
import { uploadSecureImage } from "../lib/media-upload";
import { ImageDraftPicker } from "./ImageDraftPicker";

type Tab = "announcements" | "feed" | "support-tickets" | "reports";
type Item = {
  id: string;
  title?: string;
  topic?: string;
  summary?: string;
  message?: string;
  source?: string;
  name?: string;
  email?: string;
  reference?: string;
  reason?: string;
  details?: string;
  entityType?: string;
  status: string;
  imageUrl?: string;
};
type ErrorPayload = { error?: { code?: string } };

const tabs: Array<{ id: Tab; key: string; icon: typeof Megaphone }> = [
  { id: "announcements", key: "admin.ops.tab.announcements", icon: Megaphone },
  { id: "feed", key: "admin.ops.tab.feed", icon: FileText },
  { id: "support-tickets", key: "admin.ops.tab.support", icon: Inbox },
  { id: "reports", key: "admin.ops.tab.reports", icon: Flag },
];

const announcementCategories = ["official", "faculties", "clubs", "scholarship", "events"] as const;

/**
 * Xəta mətn yox, açar kimi saxlanır. Əvvəl backend-in azərbaycanca mesajı olduğu
 * kimi göstərilirdi; vaxtı bitmiş sessiya da "Məlumatlar yüklənmədi" kimi görünürdü.
 */
class OperationError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(key);
    this.key = key;
  }
}

async function failure(response: Response, fallback: string): Promise<OperationError> {
  const payload = (await response.json().catch(() => null)) as ErrorPayload | null;
  return new OperationError(adminErrorKeyFor(response.status, payload?.error?.code, fallback));
}

function errorKeyOf(caught: unknown, fallback: string): string {
  return caught instanceof OperationError ? caught.key : fallback;
}

async function fetchItems(tab: Tab): Promise<Item[]> {
  const response = await fetch(`/api/admin/${tab}`, { cache: "no-store" });
  if (!response.ok) throw await failure(response, "admin.ops.error.load");
  const payload = (await response.json()) as { data?: Item[] };
  return payload.data ?? [];
}

export function AdminOperationsPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("announcements");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", summary: "", source: "", category: "official" });
  const [announcementImage, setAnnouncementImage] = useState<File | null>(null);

  /** Bazadan gələn kod üçün tərcümə yoxdursa xam dəyəri göstər. */
  const labelOr = (key: string, raw: string) => {
    const value = t(key);
    return value === key ? raw : value;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchItems(tab));
    } catch (caught) {
      setError(errorKeyOf(caught, "admin.ops.error.load"));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    let active = true;
    void fetchItems(tab)
      .then((next) => { if (active) setItems(next); })
      .catch((caught: unknown) => { if (active) setError(errorKeyOf(caught, "admin.ops.error.load")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);

  async function changeStatus(item: Item, status: string) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/${tab}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        // Həll qeydi bazada saxlanan məlumatdır (audit), interfeys mətni deyil.
        body: JSON.stringify(tab === "reports" ? { status, resolutionNote: status === "resolved" ? "Moderator məzmunu yoxladı və şikayəti həll etdi." : "Moderator şikayəti əsassız hesab etdi." } : { status }),
      });
      if (!response.ok) throw await failure(response, "admin.ops.error.status");
      const payload = (await response.json()) as { data?: Item };
      if (!payload.data) throw new OperationError("admin.ops.error.status");
      const updated = payload.data;
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
    } catch (caught) {
      setError(errorKeyOf(caught, "admin.ops.error.status"));
    } finally {
      setBusyId("");
    }
  }

  async function remove(item: Item) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/${tab}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) throw await failure(response, "admin.ops.error.delete");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setConfirmId("");
    } catch (caught) {
      setError(errorKeyOf(caught, "admin.ops.error.delete"));
    } finally {
      setBusyId("");
    }
  }

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new");
    setError("");
    try {
      // Əvvəl başlama vaxtı "indidən 24 saat sonra" idi — bu gün dərc olunan elanın
      // kartında sabahın tarixi yazılırdı.
      const startsAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          sourceInitials: draft.source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""),
          tone: "lime", startsAt, expiresAt, priority: false, status: "draft",
        }),
      });
      if (!response.ok) throw await failure(response, "admin.ops.error.create");
      const payload = (await response.json()) as { data?: Item };
      if (!payload.data) throw new OperationError("admin.ops.error.create");
      let created = payload.data;
      if (announcementImage) {
        try {
          const asset = await uploadSecureImage(announcementImage, "announcement", created.id);
          created = { ...created, imageUrl: asset.secureUrl };
        } catch {
          setError("admin.ops.error.image");
        }
      }
      setItems((current) => [created, ...current]);
      setDraft({ title: "", summary: "", source: "", category: "official" });
      setAnnouncementImage(null);
      setCreating(false);
    } catch (caught) {
      setError(errorKeyOf(caught, "admin.ops.error.create"));
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="admin-operations" aria-labelledby="admin-operations-title">
      <header className="admin-operations__header">
        <div>
          <span>{t("admin.ops.eyebrow")}</span>
          <h2 id="admin-operations-title">{t("admin.ops.title")}</h2>
        </div>
        <div className="admin-operations__actions">
          {tab === "announcements" && <button type="button" onClick={() => setCreating((value) => !value)}><Plus size={16} aria-hidden="true" /> {t("admin.ops.newAnnouncement")}</button>}
          <button type="button" onClick={() => void load()} disabled={loading} aria-label={t("admin.ops.refresh")}><RefreshCw size={16} className={loading ? "is-spinning" : ""} aria-hidden="true" /></button>
        </div>
      </header>

      <div className="admin-operations__tabs" role="tablist" aria-label={t("admin.ops.tablist")}>
        {tabs.map(({ id, key, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setLoading(true); setError(""); setConfirmId(""); setTab(id); }}>
            <Icon size={15} aria-hidden="true" /> {t(key)}
          </button>
        ))}
      </div>

      {tab === "announcements" && creating && (
        <form className="admin-announcement-form" onSubmit={createAnnouncement}>
          <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={t("admin.ops.form.title")} aria-label={t("admin.ops.form.title")} minLength={3} maxLength={180} required />
          <input value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} placeholder={t("admin.ops.form.source")} aria-label={t("admin.ops.form.source")} minLength={2} maxLength={140} required />
          <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} aria-label={t("admin.ops.form.category")}>
            {announcementCategories.map((category) => <option key={category} value={category}>{t(`category.${category}`)}</option>)}
          </select>
          <textarea value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder={t("admin.ops.form.summary")} aria-label={t("admin.ops.form.summary")} minLength={10} maxLength={800} rows={3} required />
          <ImageDraftPicker file={announcementImage} onChange={setAnnouncementImage} label={t("admin.ops.form.image")} compact />
          <p className="admin-announcement-form__note">{t("admin.ops.form.note")}</p>
          <footer><button type="button" onClick={() => setCreating(false)}>{t("common.cancel")}</button><button type="submit" disabled={busyId === "new"}>{t("admin.ops.form.submit")}</button></footer>
        </form>
      )}

      <div aria-live="polite">
        {error && <p className="admin-operations__error" role="alert">{t(error)}</p>}
      </div>
      {loading ? (
        <div className="admin-operations__loading" aria-label={t("admin.ops.loading")}>{[1, 2, 3].map((key) => <i key={key} />)}</div>
      ) : items.length === 0 ? (
        <div className="admin-operations__empty"><Inbox size={22} aria-hidden="true" /><strong>{t("admin.ops.empty")}</strong></div>
      ) : (
        <div className="admin-operations__list">
          {items.map((item) => (
            <article key={item.id}>
              {item.imageUrl ? <span className="admin-operation-image" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" /> : null}
              <div>
                <small>{item.reference ?? item.source ?? item.name ?? (item.entityType ? labelOr(`admin.ops.entity.${item.entityType}`, item.entityType) : "EduRate")}</small>
                <h3>{item.title ?? item.topic ?? (item.reason ? labelOr(`admin.ops.reason.${item.reason}`, item.reason) : t("admin.ops.fallbackTitle"))}</h3>
                <p>{item.summary ?? item.message ?? (item.details || t("admin.ops.noDetails"))}</p>
                {tab === "support-tickets" && item.email ? (
                  <small className="admin-ticket-contact">{item.name} · <a href={`mailto:${item.email}?subject=${encodeURIComponent(item.reference ?? "EduRate")}`}>{item.email}</a></small>
                ) : null}
              </div>
              <footer>
                <span className={`is-${item.status}`}>{labelOr(`admin.ops.status.${item.status}`, item.status)}</span>
                {confirmId === item.id ? (
                  // Silmə bir kliklə, xəbərdarlıqsız idi — elan və paylaşım geri qaytarılmır.
                  <>
                    <strong className="admin-operations__confirm">{t("admin.ops.confirmDelete")}</strong>
                    <button type="button" disabled={busyId === item.id} onClick={() => setConfirmId("")}>{t("common.cancel")}</button>
                    <button type="button" className="is-danger" disabled={busyId === item.id} onClick={() => void remove(item)}><Trash2 size={14} aria-hidden="true" /> {t("admin.sheet.confirmDelete")}</button>
                  </>
                ) : (
                  <>
                    {tab === "announcements" && item.status !== "published" && (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "published")}><Check size={14} aria-hidden="true" /> {t("admin.ops.publish")}</button>
                    )}
                    {tab === "announcements" && item.status === "published" && (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "draft")}><X size={14} aria-hidden="true" /> {t("admin.ops.unpublish")}</button>
                    )}
                    {tab === "feed" && item.status === "pending" && <>
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "published")}><Check size={14} aria-hidden="true" /> {t("admin.ops.approve")}</button>
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "rejected")}><X size={14} aria-hidden="true" /> {t("admin.ops.reject")}</button>
                    </>}
                    {tab === "support-tickets" && item.status !== "resolved" && (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, item.status === "open" ? "in_progress" : "resolved")}>
                        <Check size={14} aria-hidden="true" /> {t(item.status === "open" ? "admin.ops.startWork" : "admin.ops.resolve")}
                      </button>
                    )}
                    {tab === "support-tickets" && item.status === "resolved" && (
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "open")}>
                        <RotateCcw size={14} aria-hidden="true" /> {t("admin.ops.reopen")}
                      </button>
                    )}
                    {tab === "reports" && (item.status === "open" || item.status === "reviewing") && <>
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "resolved")}><Check size={14} aria-hidden="true" /> {t("admin.ops.resolve")}</button>
                      <button type="button" disabled={busyId === item.id} onClick={() => void changeStatus(item, "dismissed")}><X size={14} aria-hidden="true" /> {t("admin.ops.dismiss")}</button>
                    </>}
                    {tab !== "support-tickets" && tab !== "reports" && <button type="button" className="is-danger" disabled={busyId === item.id} onClick={() => setConfirmId(item.id)} aria-label={t("admin.ops.delete")}><Trash2 size={14} aria-hidden="true" /></button>}
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { EyeOff, MessageSquare, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { bakuDateParts } from "../lib/date";
import { useAuth } from "./AuthProvider";

type AnnouncementComment = {
  id: string;
  body: string;
  anonymous: boolean;
  author: { name: string; avatarUrl?: string } | null;
  mine: boolean;
  createdAt: string;
};

const MODERATOR_ROLES = ["owner_admin", "admin", "assistant_admin"];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join("");
}

/**
 * Elana şərhlər. İstifadəçi hər şərhdə anonim olub-olmamağı seçir; anonim
 * şərhdə ad və şəkil serverdən heç gəlmir (backend gizlədir).
 */
export function AnnouncementComments({ announcementId, initialCount = 0 }: { announcementId: string; initialCount?: number }) {
  const { user } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [comments, setComments] = useState<AnnouncementComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const isModerator = MODERATOR_ROLES.includes(user?.accessRole ?? "");
  const base = `/api/network/announcements/${encodeURIComponent(announcementId)}/comments`;

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(base, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { data?: AnnouncementComment[] } | null;
      if (!response.ok || !payload?.data) throw new Error();
      setComments(payload.data);
      setCount(payload.data.length);
    } catch {
      setLoadError("ann.comments.loadFailed");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !comments) void load();
  }

  function applyResult(data: { comments: AnnouncementComment[]; count: number }) {
    setComments(data.comments);
    setCount(data.count);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (body.length < 2 || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, anonymous }) });
      const payload = (await response.json().catch(() => null)) as { data?: { comments: AnnouncementComment[]; count: number } } | null;
      if (!response.ok || !payload?.data) {
        throw new Error(response.status === 401 ? "ann.sessionExpired" : response.status === 429 ? "ann.comments.rateLimited" : "ann.comments.sendFailed");
      }
      applyResult(payload.data);
      setDraft("");
    } catch (reason) {
      setError(reason instanceof Error && reason.message.startsWith("ann.") ? reason.message : "ann.comments.sendFailed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    if (confirmId !== commentId) { setConfirmId(commentId); return; }
    setError("");
    try {
      const response = await fetch(`${base}/${encodeURIComponent(commentId)}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { data?: { comments: AnnouncementComment[]; count: number } } | null;
      if (!response.ok || !payload?.data) throw new Error();
      applyResult(payload.data);
    } catch {
      setError("ann.comments.deleteFailed");
    } finally {
      setConfirmId("");
    }
  }

  function when(value: string) {
    const parts = bakuDateParts(value);
    return `${Number(parts.day)} ${t(`monthShort.${parts.month}`)} · ${parts.time}`;
  }

  return (
    <div className="announcement-comments">
      <button type="button" className="announcement-comments-toggle" aria-expanded={open} onClick={toggle}>
        <MessageSquare size={14} aria-hidden="true" /> {t("ann.comments.toggle", { count })}
      </button>
      {open ? (
        <div className="announcement-comments-panel">
          {loading && !comments ? <p className="announcement-comments-state" role="status">{t("ann.comments.loading")}</p> : null}
          {loadError ? (
            <p className="announcement-comments-state is-error" role="alert">
              {t(loadError)} <button type="button" onClick={() => void load()}>{t("common.retry")}</button>
            </p>
          ) : null}
          {comments && !comments.length ? <p className="announcement-comments-state">{t("ann.comments.empty")}</p> : null}
          {comments?.length ? (
            <ul className="announcement-comment-list">
              {comments.map((comment) => {
                const canDelete = comment.mine || isModerator;
                const confirming = confirmId === comment.id;
                return (
                  <li key={comment.id} className={comment.anonymous ? "is-anonymous" : undefined}>
                    <span
                      className={`announcement-comment-avatar${comment.author?.avatarUrl ? " has-image" : ""}`}
                      style={comment.author?.avatarUrl ? { backgroundImage: `url("${comment.author.avatarUrl}")` } : undefined}
                      aria-hidden="true"
                    >
                      {comment.author ? (comment.author.avatarUrl ? null : initials(comment.author.name)) : <EyeOff size={14} />}
                    </span>
                    <div>
                      <header>
                        <strong>{comment.author?.name ?? t("ann.comments.anonymous")}</strong>
                        {comment.mine ? <em>{t("ann.comments.you")}</em> : null}
                        <time dateTime={comment.createdAt}>{when(comment.createdAt)}</time>
                      </header>
                      <p>{comment.body}</p>
                    </div>
                    {canDelete ? (
                      <button type="button" className={`announcement-comment-delete${confirming ? " is-confirming" : ""}`} onClick={() => void remove(comment.id)}
                        onBlur={() => { if (confirming) setConfirmId(""); }} aria-label={t(confirming ? "ann.comments.deleteConfirm" : "ann.comments.delete")}>
                        <Trash2 size={13} aria-hidden="true" />{confirming ? <span>{t("ann.comments.deleteConfirm")}</span> : null}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {user ? (
            <form className="announcement-comment-form" onSubmit={(event) => void submit(event)}>
              <label className="sr-only" htmlFor={`comment-${announcementId}`}>{t("ann.comments.label")}</label>
              <textarea id={`comment-${announcementId}`} value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} minLength={2} maxLength={600} placeholder={t("ann.comments.placeholder")} />
              <div className="announcement-comment-form__row">
                <label className="announcement-comment-anon">
                  <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                  <span><strong>{t("ann.comments.anonymousToggle")}</strong><small>{t("ann.comments.anonymousHint")}</small></span>
                </label>
                <button type="submit" disabled={busy || draft.trim().length < 2}>
                  <Send size={14} aria-hidden="true" /> {t(busy ? "ann.comments.sending" : "ann.comments.send")}
                </button>
              </div>
              {error ? <p className="announcement-comments-state is-error" role="alert">{t(error)}</p> : null}
            </form>
          ) : (
            <p className="announcement-comments-state"><Link href="/auth?returnTo=%2Ffeed">{t("ann.comments.signIn")}</Link></p>
          )}
        </div>
      ) : null}
    </div>
  );
}

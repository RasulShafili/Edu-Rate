"use client";

import { CheckCircle2, ShieldCheck, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BodyPortal } from "./ui/BodyPortal";
import { useT } from "../i18n/LanguageProvider";

/**
 * Tələbə paylaşımı forması.
 *
 * Lent "Tələbə paylaşımı" kartlarını göstərirdi və backend `POST /api/network/feed`
 * endpoint-i işləyirdi, amma saytda paylaşım yazmağın heç bir yolu yox idi.
 * Forma elan göndərmə dialoqu ilə eyni məntiqi izləyir: paylaşım admin
 * yoxlanışına düşür, təsdiqlənənə qədər lentdə görünmür.
 */
type Props = { open: boolean; onClose: () => void };

const MAX_TAGS = 5;

export function FeedPostDialog({ open, onClose }: Props) {
  const t = useT();
  const [draft, setDraft] = useState({ title: "", summary: "", tags: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!open) return null;

  const tags = draft.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/network/feed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: draft.title.trim(), summary: draft.summary.trim(), tags }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { data?: unknown; error?: { message?: string } }
        | null;
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? t("feed.postFailed"));
      }
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("feed.postFailed"));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setDone(false);
    setDraft({ title: "", summary: "", tags: "" });
    setError("");
    onClose();
  }

  return (
    <BodyPortal>
    <div
      className="content-submission-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) close();
      }}
    >
      <section
        className="content-submission-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feed-post-title"
      >
        <header>
          <div>
            <small>{t("feed.postEyebrow")}</small>
            <h2 id="feed-post-title">{t("feed.postTitle")}</h2>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label={t("ann.close")}>
            <X size={19} />
          </button>
        </header>

        {done ? (
          <div className="content-submission-success">
            <CheckCircle2 size={36} />
            <h3>{t("feed.postSentTitle")}</h3>
            <p>{t("feed.postSentBody")}</p>
            <button type="button" onClick={close}>{t("ann.close")}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="content-submission-note">
              <ShieldCheck size={18} />
              <p>{t("feed.postNote")}</p>
            </div>
            <div className="content-submission-grid">
              <label className="is-wide">
                <span>{t("feed.fieldTitle")}</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  minLength={3}
                  maxLength={180}
                  required
                  autoFocus
                  placeholder={t("feed.fieldTitlePlaceholder")}
                />
              </label>
              <label className="is-wide">
                <span>{t("feed.fieldBody")}</span>
                <textarea
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  minLength={10}
                  maxLength={800}
                  rows={5}
                  required
                  placeholder={t("feed.fieldBodyPlaceholder")}
                />
              </label>
              <label className="is-wide">
                <span>{t("feed.fieldTags")}</span>
                <input
                  value={draft.tags}
                  onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                  maxLength={180}
                  placeholder={t("feed.fieldTagsPlaceholder")}
                />
                <small>{t("feed.tagsHint", { max: MAX_TAGS, count: tags.length })}</small>
              </label>
            </div>
            {error ? <p className="content-submission-error" role="alert">{error}</p> : null}
            <footer>
              <button type="button" onClick={close} disabled={busy}>{t("ann.cancel")}</button>
              <button type="submit" disabled={busy}>
                {busy ? t("ann.sending") : t("ann.sendForReview")}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
    </BodyPortal>
  );
}

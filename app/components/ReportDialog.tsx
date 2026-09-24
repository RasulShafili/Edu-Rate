"use client";

import { CheckCircle2, Flag, X } from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n/LanguageProvider";
import { adminErrorKeyFor } from "../lib/admin-errors";

export type ReportTarget = {
  entityType: "message" | "profile" | "club";
  entityId: string;
  /** İstifadəçiyə nədən şikayət etdiyini xatırladan qısa ad. */
  label: string;
};

const REASONS = ["abuse", "threat", "discrimination", "spam", "fake_profile", "personal_data", "other"] as const;
type Reason = (typeof REASONS)[number];
const subscribeNoop = () => () => {};

/**
 * Şikayət forması. Əvvəl şikayət yalnız söhbət menyusundan mümkün idi və səbəb
 * həmişə "təhqir" göndərilirdi, təfərrüat isə sabit mətn idi — moderator spam
 * şikayətini də "təhqir" kimi görürdü. İndi istifadəçi səbəbi seçir və yazır.
 *
 * Portal ilə `body`-yə çıxır: söhbət paneli sürüklənir (transform), onun içində
 * `position: fixed` pəncərəni panelə bağlayardı.
 */
export function ReportDialog({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const t = useT();
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [reason, setReason] = useState<Reason>("abuse");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!target || !mounted) return null;
  const current = target;

  function close() {
    if (busy) return;
    setReason("abuse");
    setDetails("");
    setError("");
    setSent(false);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType: current.entityType, entityId: current.entityId, reason, details: details.trim() }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
        setError(adminErrorKeyFor(response.status, payload?.error?.code, "report.failed"));
        return;
      }
      setSent(true);
    } catch {
      setError("report.failed");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="kuds-shell" style={{ display: "contents" }}>
      <div className="content-submission-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <section className="content-submission-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
          <header>
            <div>
              <small>{t("report.eyebrow")}</small>
              <h2 id="report-dialog-title">{t(`report.title.${current.entityType}`)}</h2>
            </div>
            <button type="button" onClick={close} disabled={busy} aria-label={t("common.close")}><X size={19} aria-hidden="true" /></button>
          </header>
          {sent ? (
            <div className="content-submission-success">
              <CheckCircle2 size={36} aria-hidden="true" />
              <h3>{t("report.sentTitle")}</h3>
              <p>{t("report.sent")}</p>
              <button type="button" onClick={close}>{t("common.close")}</button>
            </div>
          ) : (
            <form method="post" onSubmit={submit}>
              <div className="content-submission-note">
                <Flag size={18} aria-hidden="true" />
                <p>{t("report.subject", { name: current.label })}</p>
              </div>
              <div className="content-submission-grid">
                <label className="is-wide">
                  <span>{t("report.reason")}</span>
                  <select value={reason} onChange={(event) => setReason(event.target.value as Reason)} autoFocus>
                    {REASONS.map((item) => <option key={item} value={item}>{t(`admin.ops.reason.${item}`)}</option>)}
                  </select>
                </label>
                <label className="is-wide">
                  <span>{t("report.details")}</span>
                  <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={4} placeholder={t("report.detailsHint")} />
                </label>
              </div>
              <div aria-live="polite">{error ? <p className="content-submission-error" role="alert">{t(error)}</p> : null}</div>
              <footer>
                <button type="button" onClick={close} disabled={busy}>{t("common.cancel")}</button>
                <button type="submit" disabled={busy}>{busy ? t("report.sending") : t("report.submit")}</button>
              </footer>
            </form>
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}

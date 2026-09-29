"use client";

import { Check, KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";

const MIN_LENGTH = 10;

/**
 * Şifrə dəyişmək. Əvvəl yalnız girişdən əvvəl "Şifrəni unutdum" var idi.
 * Cari şifrə backend-də yoxlanılır (səhv cəhdlər girişlə eyni sayğacdadır),
 * uğurdan sonra digər cihazlar çıxarılır, bu sessiya qalır.
 */
export function ChangePasswordPanel() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState("");
  const [done, setDone] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrorKey("");
  }

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = current.length > 0 && next.length >= MIN_LENGTH && next === confirm && next !== current;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErrorKey("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string; details?: { reason?: string } } } | null;
        const code = payload?.error?.code;
        setErrorKey(
          code === "INVALID_CREDENTIALS" ? "changePassword.wrong"
            : code === "WEAK_PASSWORD" ? `password.problem.${payload?.error?.details?.reason ?? "common"}`
              : code === "SAME_PASSWORD" ? "changePassword.same"
                : code === "ACCOUNT_THROTTLED" || response.status === 429 ? "changePassword.throttled"
                  : response.status === 401 ? "changePassword.sessionExpired"
                    : "changePassword.failed",
        );
        return;
      }
      reset();
      setOpen(false);
      setDone(true);
    } catch {
      setErrorKey("changePassword.failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-card change-password" aria-labelledby="change-password-title">
      <div className="settings-intro">
        <h2 id="change-password-title"><KeyRound size={17} aria-hidden="true" /> {t("changePassword.title")}</h2>
        <p>{t("changePassword.body")}</p>
      </div>
      {done && !open ? <p className="change-password__done" role="status"><Check size={15} aria-hidden="true" /> {t("changePassword.done")}</p> : null}
      {!open ? (
        <div className="change-password__actions">
          <button type="button" onClick={() => { setOpen(true); setDone(false); }}>{t("changePassword.open")}</button>
        </div>
      ) : (
        <form className="change-password__form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="cp-current">
            {t("changePassword.current")}
            <input id="cp-current" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required disabled={busy} />
          </label>
          <label htmlFor="cp-new">
            {t("changePassword.new")}
            <input id="cp-new" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required minLength={MIN_LENGTH} disabled={busy} aria-describedby="cp-hint" />
            <small id="cp-hint">{t("changePassword.hint", { count: MIN_LENGTH })}</small>
          </label>
          <label htmlFor="cp-confirm">
            {t("changePassword.confirm")}
            <input id="cp-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required disabled={busy} aria-invalid={mismatch} />
            {mismatch ? <small className="is-error">{t("changePassword.mismatch")}</small> : null}
          </label>
          {errorKey ? <p className="change-password__error" role="alert">{t(errorKey)}</p> : null}
          <div className="change-password__actions">
            <button type="button" onClick={() => { setOpen(false); reset(); }} disabled={busy}>{t("changePassword.cancel")}</button>
            <button type="submit" className="is-primary" disabled={!valid || busy}>{busy ? t("changePassword.saving") : t("changePassword.submit")}</button>
          </div>
        </form>
      )}
    </section>
  );
}

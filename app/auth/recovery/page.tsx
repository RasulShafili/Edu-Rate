"use client";

import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { PasswordStrength, passwordProblemKey } from "../../components/PasswordStrength";
import { useT } from "../../i18n/LanguageProvider";

type RecoveryStage = "request" | "code" | "password" | "success";
type ErrorPayload = { error?: { code?: string; details?: Record<string, string> } };

/** Server xətasını tərcümə açarına çevirir (server mətni azərbaycancadır). */
function errorKey(payload: ErrorPayload | null, fallback: string) {
  const code = payload?.error?.code;
  if (code === "ACCOUNT_THROTTLED" || code === "RATE_LIMITED") return "recovery.error.throttled";
  if (code === "CODE_INVALID") return "recovery.error.code";
  if (code === "RESET_EXPIRED") return "recovery.error.expired";
  if (code === "EMAIL_DELIVERY_UNAVAILABLE") return "recovery.error.delivery";
  if (code === "WEAK_PASSWORD") return `password.problem.${payload?.error?.details?.reason ?? "common"}`;
  return fallback;
}

export default function RecoveryPage() {
  const t = useT();
  const invitationToken = useSearchParams().get("token") ?? "";
  const [stage, setStage] = useState<RecoveryStage>(invitationToken ? "password" : "request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState(invitationToken);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  function fail(key: string) {
    setIsError(true);
    setMessage(key);
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/actions/password/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => null) as ErrorPayload | null;
      if (!response.ok) return fail(errorKey(payload, "recovery.error.send"));
      setStage("code");
      setMessage("recovery.codeSent");
    } catch {
      fail("recovery.error.send");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/actions/password/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: String(form.get("code") ?? "").replace(/\D/g, "") }),
      });
      const payload = await response.json().catch(() => null) as (ErrorPayload & { data?: { resetToken?: string } }) | null;
      if (!response.ok || !payload?.data?.resetToken) return fail(errorKey(payload, "recovery.error.code"));
      setResetToken(payload.data.resetToken);
      setStage("password");
    } catch {
      fail("recovery.error.code");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    const problem = passwordProblemKey(password, { email });
    if (problem) return fail(problem);
    if (password !== passwordConfirm) return fail("recovery.error.mismatch");
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/actions/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resetToken, password, passwordConfirm }),
      });
      const payload = await response.json().catch(() => null) as ErrorPayload | null;
      if (!response.ok) return fail(errorKey(payload, "recovery.error.reset"));
      setStage("success");
      setMessage("");
    } catch {
      fail("recovery.error.reset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="route-page recovery-page">
      <section className="recovery-card" aria-labelledby="recovery-title">
        <aside className="recovery-card__visual" aria-hidden="true">
          <span className="recovery-brand"><i /> EDURATE</span>
          <div><ShieldCheck size={42} strokeWidth={1.4} /><h2>{t("recovery.visual.title")}</h2><p>{t("recovery.visual.text")}</p></div>
          <small>{t("recovery.visual.note")}</small>
        </aside>

        <article className="recovery-card__content">
          {stage === "request" ? (
            <>
              <span className="recovery-step">{t("recovery.step1")}</span><div className="recovery-icon"><Mail size={22} /></div>
              <h1 id="recovery-title">{t("recovery.request.title")}</h1>
              <p>{t("recovery.request.text")}</p>
              <form method="post" className="account-recovery-form" onSubmit={requestCode}>
                <label><span>{t("auth.email")}</span><input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" autoComplete="email" placeholder="ad.soyad@example.com" required autoFocus /></label>
                <button type="submit" disabled={busy}>{busy ? t("recovery.request.sending") : t("recovery.request.submit")}</button>
              </form>
            </>
          ) : stage === "code" ? (
            <>
              <span className="recovery-step">{t("recovery.step2")}</span><div className="recovery-icon"><KeyRound size={22} /></div>
              <h1 id="recovery-title">{t("recovery.code.title")}</h1>
              <p>{t("recovery.code.text", { email })}</p>
              <form method="post" className="account-recovery-form" onSubmit={verifyCode}>
                <label className="recovery-code-field"><span>{t("recovery.code.label")}</span><input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required autoFocus /></label>
                <button type="submit" disabled={busy}>{busy ? t("auth.checking") : t("recovery.code.submit")}</button>
              </form>
              <div className="recovery-secondary-actions"><button type="button" onClick={() => void requestCode()} disabled={busy}>{t("recovery.code.resend")}</button><button type="button" onClick={() => { setStage("request"); setMessage(""); }}>{t("recovery.code.changeEmail")}</button></div>
            </>
          ) : stage === "password" ? (
            <>
              <span className="recovery-step">{t("recovery.step3")}</span><div className="recovery-icon"><LockKeyhole size={22} /></div>
              <h1 id="recovery-title">{t("recovery.password.title")}</h1>
              <p>{t("recovery.password.text")}</p>
              <form method="post" className="account-recovery-form" onSubmit={resetPassword}>
                <label><span>{t("recovery.password.new")}</span><span className="recovery-input-with-icon"><LockKeyhole size={17} /><input name="password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" aria-describedby="recovery-password-strength" required /></span></label>
                <PasswordStrength id="recovery-password-strength" password={newPassword} email={email} />
                <label><span>{t("recovery.password.confirm")}</span><span className="recovery-input-with-icon"><LockKeyhole size={17} /><input name="passwordConfirm" type="password" autoComplete="new-password" required /></span></label>
                <button type="submit" disabled={busy}>{busy ? t("recovery.password.saving") : t("recovery.password.submit")}</button>
              </form>
            </>
          ) : (
            <div className="recovery-success"><CheckCircle2 size={52} /><span className="recovery-step">{t("recovery.success.step")}</span><h1 id="recovery-title">{t("recovery.success.title")}</h1><p>{t("recovery.success.text")}</p><Link href="/auth">{t("auth.submitSignIn")}</Link></div>
          )}

          {message ? <p className={`recovery-message${isError ? " is-error" : ""}`} role={isError ? "alert" : "status"}>{t(message)}</p> : null}
          {stage !== "success" ? <Link className="recovery-back" href="/auth"><ArrowLeft size={15} /> {t("recovery.back")}</Link> : null}
        </article>
      </section>
    </main>
  );
}

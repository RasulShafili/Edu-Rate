"use client";

import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

type RecoveryStage = "request" | "code" | "password" | "success";

export default function RecoveryPage() {
  const invitationToken = useSearchParams().get("token") ?? "";
  const [stage, setStage] = useState<RecoveryStage>(invitationToken ? "password" : "request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState(invitationToken);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

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
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Kod göndərilmədi.");
      setStage("code");
      setMessage("Hesab mövcuddursa, 6 rəqəmli kod e-poçt ünvanına göndərildi.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Kod göndərilmədi.");
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
      const payload = await response.json() as { data?: { resetToken?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.resetToken) throw new Error(payload.error?.message || "Kod təsdiqlənmədi.");
      setResetToken(payload.data.resetToken);
      setStage("password");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Kod təsdiqlənmədi.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    if (password !== passwordConfirm) {
      setIsError(true);
      setMessage("Yeni şifrələr eyni deyil.");
      return;
    }
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch("/api/auth/actions/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resetToken, password, passwordConfirm }),
      });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Şifrə yenilənmədi.");
      setStage("success");
      setMessage("");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Şifrə yenilənmədi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="route-page recovery-page">
      <section className="recovery-card" aria-labelledby="recovery-title">
        <aside className="recovery-card__visual" aria-hidden="true">
          <span className="recovery-brand"><i /> EDURATE</span>
          <div><ShieldCheck size={42} strokeWidth={1.4} /><h2>Hesabınıza təhlükəsiz qayıdın.</h2><p>Birdəfəlik kod yalnız 10 dəqiqə qüvvədə qalır.</p></div>
          <small>Müstəqil tələbə pilot platforması</small>
        </aside>

        <article className="recovery-card__content">
          {stage === "request" ? (
            <>
              <span className="recovery-step">01 / E-POÇT</span><div className="recovery-icon"><Mail size={22} /></div>
              <h1 id="recovery-title">Şifrənizi bərpa edin</h1>
              <p>E-poçt ünvanınızı yazın. Sizə 6 rəqəmli təhlükəsizlik kodu göndərəcəyik.</p>
              <form method="post" className="account-recovery-form" onSubmit={requestCode}>
                <label><span>E-poçt ünvanı</span><input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" autoComplete="email" placeholder="ad.soyad@example.com" required autoFocus /></label>
                <button type="submit" disabled={busy}>{busy ? "Göndərilir…" : "Bərpa kodunu göndər"}</button>
              </form>
            </>
          ) : stage === "code" ? (
            <>
              <span className="recovery-step">02 / KOD TƏSDİQİ</span><div className="recovery-icon"><KeyRound size={22} /></div>
              <h1 id="recovery-title">Kodu daxil edin</h1>
              <p><strong>{email}</strong> ünvanına göndərilən 6 rəqəmli kodu yazın. Kod doğru olduqda yeni şifrə bölməsi açılacaq.</p>
              <form method="post" className="account-recovery-form" onSubmit={verifyCode}>
                <label className="recovery-code-field"><span>6 rəqəmli kod</span><input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required autoFocus /></label>
                <button type="submit" disabled={busy}>{busy ? "Yoxlanılır…" : "Kodu təsdiqlə"}</button>
              </form>
              <div className="recovery-secondary-actions"><button type="button" onClick={() => void requestCode()} disabled={busy}>Kodu yenidən göndər</button><button type="button" onClick={() => { setStage("request"); setMessage(""); }}>E-poçtu dəyiş</button></div>
            </>
          ) : stage === "password" ? (
            <>
              <span className="recovery-step">03 / YENİ ŞİFRƏ</span><div className="recovery-icon"><LockKeyhole size={22} /></div>
              <h1 id="recovery-title">Yeni şifrə yaradın</h1>
              <p>Kod təsdiqləndi. Təhlükəsiz yeni şifrənizi iki dəfə daxil edin.</p>
              <form method="post" className="account-recovery-form" onSubmit={resetPassword}>
                <label><span>Yeni şifrə</span><span className="recovery-input-with-icon"><LockKeyhole size={17} /><input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></span></label>
                <label><span>Yeni şifrəni təkrar et</span><span className="recovery-input-with-icon"><LockKeyhole size={17} /><input name="passwordConfirm" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></span></label>
                <button type="submit" disabled={busy}>{busy ? "Yenilənir…" : "Şifrəni yenilə"}</button>
              </form>
            </>
          ) : (
            <div className="recovery-success"><CheckCircle2 size={52} /><span className="recovery-step">TAMAMLANDI</span><h1 id="recovery-title">Şifrəniz yeniləndi</h1><p>Yeni şifrənizlə EduRate hesabınıza daxil ola bilərsiniz.</p><Link href="/auth">Daxil ol</Link></div>
          )}

          {message ? <p className={`recovery-message${isError ? " is-error" : ""}`} role={isError ? "alert" : "status"}>{message}</p> : null}
          {stage !== "success" ? <Link className="recovery-back" href="/auth"><ArrowLeft size={15} /> Giriş səhifəsinə qayıt</Link> : null}
        </article>
      </section>
    </main>
  );
}

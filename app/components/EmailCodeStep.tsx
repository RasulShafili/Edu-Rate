"use client";

import { ArrowLeft, MailCheck, RotateCw } from "lucide-react";
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { ApiError } from "../lib/api/client";
import type { EmailChallenge, EmailCodeResult } from "../data/user";
import { useAuth } from "./AuthProvider";

const LENGTH = 6;
const RESEND_SECONDS = 60;

type Props = {
  challenge: EmailChallenge;
  purpose: "login" | "signup";
  onVerified: (result: EmailCodeResult) => void;
  /** Bilet etibarsızdır (vaxt bitdi, kilid): istifadəçi yenidən şifrə daxil etməlidir. */
  onRestart: (messageKey: string, values?: Record<string, string | number>) => void;
};

/**
 * E-poçta göndərilən 6 rəqəmli kodun daxil edilməsi. Hər rəqəm ayrı xanadadır:
 * yazanda növbəti xanaya keçir, Backspace geri qaytarır, yapışdırılan kod
 * bütün xanalara paylanır, 6-cı rəqəmdən sonra forma özü göndərilir.
 */
export function EmailCodeStep({ challenge, purpose, onVerified, onRestart }: Props) {
  const t = useT();
  const { completeEmailCode, resendEmailCode } = useAuth();
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: string; values?: Record<string, string | number>; error: boolean } | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [hint, setHint] = useState(challenge.emailHint);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const submitted = useRef("");
  /** Xanalar yoxlama zamanı bağlıdır (`disabled`); fokus yalnız açılandan sonra verilə bilər. */
  const refocus = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (busy || !refocus.current) return;
    refocus.current = false;
    inputs.current[0]?.focus();
  }, [busy]);

  async function submit(code: string) {
    if (busy || code.length !== LENGTH || submitted.current === code) return;
    submitted.current = code;
    setBusy(true);
    setMessage(null);
    try {
      onVerified(await completeEmailCode(challenge.challenge, code));
    } catch (error) {
      submitted.current = "";
      const apiError = error instanceof ApiError ? error : null;
      const details = (apiError?.details && typeof apiError.details === "object" ? apiError.details : {}) as Record<string, unknown>;
      if (apiError?.code === "CHALLENGE_EXPIRED") return onRestart("auth.emailCode.expired");
      if (apiError?.code === "ACCOUNT_THROTTLED") {
        return onRestart("auth.error.throttled", { count: Math.ceil((Number(details.retryAfter) || 1800) / 60) });
      }
      setDigits(Array(LENGTH).fill(""));
      refocus.current = true;
      setMessage({ key: apiError?.code === "CODE_INVALID" ? "auth.emailCode.invalid" : apiError?.code === "RATE_LIMITED" ? "auth.error.rateLimited" : "auth.error.loginFailed", error: true });
    } finally {
      setBusy(false);
    }
  }

  function update(next: string[]) {
    setDigits(next);
    const code = next.join("");
    if (code.length === LENGTH) void submit(code);
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // Avtomatik doldurma (SMS/e-poçt təklifi) bir xanaya bütün kodu yaza bilər.
    const next = [...digits];
    clean.slice(0, LENGTH - index).split("").forEach((digit, offset) => { next[index + offset] = digit; });
    const focusIndex = Math.min(index + clean.length, LENGTH - 1);
    inputs.current[focusIndex]?.focus();
    update(next);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(LENGTH).fill("").map((_, index) => pasted[index] ?? "");
    inputs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
    update(next);
  }

  async function resend() {
    if (cooldown > 0 || busy) return;
    setMessage(null);
    try {
      const result = await resendEmailCode(challenge.challenge);
      setHint(result.emailHint || hint);
      setCooldown(result.retryAfter || RESEND_SECONDS);
      setDigits(Array(LENGTH).fill(""));
      submitted.current = "";
      inputs.current[0]?.focus();
      setMessage({ key: "auth.emailCode.resent", error: false });
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      const details = (apiError?.details && typeof apiError.details === "object" ? apiError.details : {}) as Record<string, unknown>;
      if (apiError?.code === "CHALLENGE_EXPIRED" || apiError?.code === "RESEND_LIMIT") return onRestart(apiError.code === "RESEND_LIMIT" ? "auth.emailCode.resendLimit" : "auth.emailCode.expired");
      if (apiError?.code === "RESEND_TOO_SOON") {
        setCooldown(Number(details.retryAfter) || RESEND_SECONDS);
        return;
      }
      setMessage({ key: apiError?.code === "EMAIL_DELIVERY_UNAVAILABLE" ? "auth.emailCode.deliveryFailed" : "auth.emailCode.resendFailed", error: true });
    }
  }

  return (
    <form className="auth-form auth-email-code" noValidate aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void submit(digits.join("")); }}>
      <div className="auth-email-code__sent">
        <span aria-hidden="true"><MailCheck size={18} /></span>
        <p>{t(purpose === "signup" ? "auth.emailCode.sentSignup" : "auth.emailCode.sent", { email: hint })}</p>
      </div>
      <fieldset className="auth-email-code__digits" disabled={busy}>
        <legend className="sr-only">{t("auth.emailCode.label")}</legend>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => { inputs.current[index] = element; }}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={index === 0 ? LENGTH : 1}
            aria-label={t("auth.emailCode.digit", { index: index + 1 })}
            className={digit ? "is-filled" : undefined}
          />
        ))}
      </fieldset>
      <button type="submit" className="auth-submit" disabled={busy || digits.join("").length !== LENGTH}>
        <span>{t(busy ? "auth.checking" : "auth.emailCode.submit")}</span>
      </button>
      <div className="auth-email-code__actions">
        <button type="button" className="auth-link-button" onClick={() => onRestart("")} disabled={busy}>
          <ArrowLeft size={14} aria-hidden="true" /> {t("auth.twoFactor.back")}
        </button>
        <button type="button" className="auth-link-button" onClick={() => void resend()} disabled={busy || cooldown > 0}>
          <RotateCw size={14} aria-hidden="true" /> {cooldown > 0 ? t("auth.emailCode.resendIn", { count: cooldown }) : t("auth.emailCode.resend")}
        </button>
      </div>
      <p className="auth-email-code__tip">{t("auth.emailCode.tip")}</p>
      <p className={`auth-form-message${message ? " is-visible" : ""}`} role={message?.error ? "alert" : "status"} aria-live="polite">
        {message ? t(message.key, message.values) : ""}
      </p>
    </form>
  );
}

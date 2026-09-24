"use client";

import { Check, Copy, Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { useAuth } from "./AuthProvider";

type Stage =
  | { name: "idle" }
  | { name: "password" }
  | { name: "scan"; secret: string; otpauthUrl: string }
  | { name: "codes"; codes: string[] }
  | { name: "confirm"; action: "disable" | "regenerate" };

type ApiPayload<T> = { data?: T; error?: { code?: string; details?: Record<string, string> } };
type Message = { key: string; values?: Record<string, number> };

async function call<T>(path: string, body?: unknown): Promise<{ ok: boolean; status: number; payload: ApiPayload<T> | null }> {
  const response = await fetch(`/api/auth/actions/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: response.ok, status: response.status, payload: await response.json().catch(() => null) as ApiPayload<T> | null };
}

function errorMessage(status: number, payload: ApiPayload<unknown> | null): Message {
  const code = payload?.error?.code;
  if (code === "INVALID_CREDENTIALS") return { key: "twofa.error.password" };
  if (code === "TWO_FACTOR_INVALID") return { key: "twofa.error.code" };
  if (code === "ACCOUNT_THROTTLED") return { key: "auth.error.throttled", values: { count: Math.ceil((Number(payload?.error?.details?.retryAfter) || 900) / 60) } };
  if (status === 401) return { key: "admin.error.session" };
  return { key: "twofa.error.generic" };
}

/** Autentifikator tətbiqi üçün QR — `<rect>`-lərlə, `innerHTML` və şəkil URL-i olmadan. */
function QrCode({ value, label }: { value: string; label: string }) {
  const matrix = useMemo(() => QRCode.create(value, { errorCorrectionLevel: "M" }).modules, [value]);
  const size = matrix.size;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) if (matrix.get(y, x)) cells.push({ x, y });
  return (
    <svg className="two-factor__qr" viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#fff" />
      {cells.map(({ x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111" />)}
    </svg>
  );
}

export function TwoFactorPanel() {
  const t = useT();
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [remaining, setRemaining] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void call<{ enabled: boolean; recoveryCodesRemaining: number }>("2fa").then(({ ok, payload }) => {
      if (cancelled || !ok || !payload?.data) return;
      setEnabled(payload.data.enabled);
      setRemaining(payload.data.recoveryCodesRemaining);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function reset() {
    setStage({ name: "idle" });
    setMessage(null);
    setCopied(false);
  }

  async function submit<T>(path: string, body: unknown, onSuccess: (data: T) => void) {
    setBusy(true);
    setMessage(null);
    try {
      const { ok, status, payload } = await call<T>(path, body);
      if (!ok || !payload?.data) {
        setMessage(errorMessage(status, payload));
        return;
      }
      onSuccess(payload.data);
    } catch {
      setMessage({ key: "twofa.error.generic" });
    } finally {
      setBusy(false);
    }
  }

  function field(event: FormEvent<HTMLFormElement>, name: string) {
    return String(new FormData(event.currentTarget).get(name) ?? "").trim();
  }

  function startSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit<{ secret: string; otpauthUrl: string }>("2fa/setup", { password: String(new FormData(event.currentTarget).get("password") ?? "") }, (data) => {
      setStage({ name: "scan", secret: data.secret, otpauthUrl: data.otpauthUrl });
    });
  }

  function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit<{ recoveryCodes: string[] }>("2fa/enable", { code: field(event, "code").replace(/\s/g, "") }, (data) => {
      setEnabled(true);
      setRemaining(data.recoveryCodes.length);
      setStage({ name: "codes", codes: data.recoveryCodes });
    });
  }

  function confirmAction(event: FormEvent<HTMLFormElement>, action: "disable" | "regenerate") {
    event.preventDefault();
    const body = { password: String(new FormData(event.currentTarget).get("password") ?? ""), code: field(event, "code") };
    if (action === "disable") {
      void submit<{ enabled: boolean }>("2fa/disable", body, () => {
        setEnabled(false);
        setRemaining(0);
        setStage({ name: "idle" });
        setMessage({ key: "twofa.disabled" });
      });
    } else {
      void submit<{ recoveryCodes: string[] }>("2fa/recovery-codes", body, (data) => {
        setRemaining(data.recoveryCodes.length);
        setStage({ name: "codes", codes: data.recoveryCodes });
      });
    }
  }

  async function copyCodes(codes: string[]) {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setMessage({ key: "twofa.copyFailed" });
    }
  }

  function downloadCodes(codes: string[]) {
    const blob = new Blob([`EduRate — ${t("twofa.codes.fileTitle")}\n${user?.email ?? ""}\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edurate-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="two-factor" className="settings-card two-factor" aria-labelledby="two-factor-title">
      <div className="settings-intro">
        <h2 id="two-factor-title">{t("twofa.title")}</h2>
        <p>{t("twofa.text")}</p>
      </div>

      <p className={`two-factor__status${enabled ? " is-on" : ""}`}>
        {enabled ? <ShieldCheck size={16} aria-hidden="true" /> : <ShieldOff size={16} aria-hidden="true" />}
        <span>{enabled ? t("twofa.statusOn") : t("twofa.statusOff")}</span>
        {enabled && remaining !== null ? <small>{t("twofa.remaining", { count: remaining })}</small> : null}
      </p>
      {enabled && remaining !== null && remaining <= 3 && stage.name === "idle" ? (
        <p className="two-factor__warning" role="status">{t("twofa.lowCodes")}</p>
      ) : null}

      {stage.name === "idle" ? (
        <div className="two-factor__actions">
          {enabled ? (
            <>
              <button type="button" className="settings-button" onClick={() => { setMessage(null); setStage({ name: "confirm", action: "regenerate" }); }}>
                <KeyRound size={15} aria-hidden="true" /> {t("twofa.regenerate")}
              </button>
              <button type="button" className="settings-button is-danger" onClick={() => { setMessage(null); setStage({ name: "confirm", action: "disable" }); }}>
                {t("twofa.disable")}
              </button>
            </>
          ) : (
            <button type="button" className="settings-button is-primary" onClick={() => { setMessage(null); setStage({ name: "password" }); }}>
              <Smartphone size={15} aria-hidden="true" /> {t("twofa.enable")}
            </button>
          )}
        </div>
      ) : null}

      {stage.name === "password" ? (
        <form method="post" className="two-factor__form" onSubmit={startSetup}>
          <label>
            <span>{t("twofa.passwordLabel")}</span>
            <input name="password" type="password" autoComplete="current-password" required autoFocus disabled={busy} />
          </label>
          <div className="two-factor__actions">
            <button type="submit" className="settings-button is-primary" disabled={busy}>{busy ? t("auth.checking") : t("twofa.continue")}</button>
            <button type="button" className="settings-button" onClick={reset} disabled={busy}>{t("common.cancel")}</button>
          </div>
        </form>
      ) : null}

      {stage.name === "scan" ? (
        <form method="post" className="two-factor__form" onSubmit={confirmSetup}>
          <ol className="two-factor__steps">
            <li>{t("twofa.scan.step1")}</li>
            <li>{t("twofa.scan.step2")}</li>
          </ol>
          <div className="two-factor__pairing">
            <QrCode value={stage.otpauthUrl} label={t("twofa.scan.qrLabel")} />
            <div>
              <span>{t("twofa.scan.manual")}</span>
              <code className="two-factor__secret">{stage.secret.match(/.{1,4}/g)?.join(" ")}</code>
            </div>
          </div>
          <label>
            <span>{t("twofa.codeLabel")}</span>
            <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required disabled={busy} />
          </label>
          <div className="two-factor__actions">
            <button type="submit" className="settings-button is-primary" disabled={busy}>{busy ? t("auth.checking") : t("twofa.scan.confirm")}</button>
            <button type="button" className="settings-button" onClick={reset} disabled={busy}>{t("common.cancel")}</button>
          </div>
        </form>
      ) : null}

      {stage.name === "codes" ? (
        <div className="two-factor__codes">
          <h3>{t("twofa.codes.title")}</h3>
          <p>{t("twofa.codes.text")}</p>
          <ul>{stage.codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
          <div className="two-factor__actions">
            <button type="button" className="settings-button" onClick={() => void copyCodes(stage.codes)}>
              {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? t("twofa.codes.copied") : t("twofa.codes.copy")}
            </button>
            <button type="button" className="settings-button" onClick={() => downloadCodes(stage.codes)}>
              <Download size={15} aria-hidden="true" /> {t("twofa.codes.download")}
            </button>
            <button type="button" className="settings-button is-primary" onClick={reset}>{t("twofa.codes.done")}</button>
          </div>
          <p className="two-factor__note">{t("twofa.codes.sessions")}</p>
        </div>
      ) : null}

      {stage.name === "confirm" ? (
        <form method="post" className="two-factor__form" onSubmit={(event) => confirmAction(event, stage.action)}>
          <p>{stage.action === "disable" ? t("twofa.confirm.disableText") : t("twofa.confirm.regenerateText")}</p>
          <label>
            <span>{t("twofa.passwordLabel")}</span>
            <input name="password" type="password" autoComplete="current-password" required autoFocus disabled={busy} />
          </label>
          <label>
            <span>{t("twofa.codeOrRecovery")}</span>
            <input name="code" type="text" autoComplete="one-time-code" maxLength={11} placeholder="000000" required disabled={busy} />
          </label>
          <div className="two-factor__actions">
            <button type="submit" className={`settings-button${stage.action === "disable" ? " is-danger" : " is-primary"}`} disabled={busy}>
              {busy ? t("auth.checking") : stage.action === "disable" ? t("twofa.disable") : t("twofa.regenerate")}
            </button>
            <button type="button" className="settings-button" onClick={reset} disabled={busy}>{t("common.cancel")}</button>
          </div>
        </form>
      ) : null}

      {message ? (
        <p className={`two-factor__message${message.key === "twofa.disabled" ? "" : " is-error"}`} role={message.key === "twofa.disabled" ? "status" : "alert"}>
          {t(message.key, message.values)}
        </p>
      ) : null}
    </section>
  );
}

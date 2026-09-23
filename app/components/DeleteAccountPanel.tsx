"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useT } from "../i18n/LanguageProvider";
import { isAdminAccessRole } from "../lib/auth/admin-role";
import { useAuth } from "./AuthProvider";

/**
 * Hesabın silinməsi (GDPR "unudulma hüququ").
 *
 * Silinmə geri qaytarılmır, ona görə iki maneə var: əvvəlcə təsdiq addımı açılır,
 * sonra şifrə tələb olunur (backend onu yoxlayır). Beləcə nə təsadüfi klik, nə də
 * oğurlanmış açıq sessiya hesabı silə bilmir.
 *
 * Backend `deleteUser` hesabı anonimləşdirir (ad, e-poçt, profil sahələri
 * silinir, hesab bağlanır) — mətn də bunu deyir; əvvəl "rəylərin, mesajların və
 * klub üzvlüklərin silinir" yazırdı, halbuki onlar silinmir.
 */
export function DeleteAccountPanel() {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState("");

  // D7: backend administratorun öz hesabını silməsinə icazə vermir (409). Əvvəl
  // admin paneli görür, şifrəsini yazır və yalnız sonra rədd cavabı alırdı.
  if (isAdminAccessRole(user?.accessRole)) {
    return (
      <section className="danger-zone" aria-labelledby="danger-zone-title">
        <header>
          <span className="danger-zone__icon" aria-hidden="true">
            <AlertTriangle size={17} />
          </span>
          <div>
            <strong id="danger-zone-title">{t("deleteAccount.adminTitle")}</strong>
            <small>{t("deleteAccount.adminBody")}</small>
          </div>
        </header>
      </section>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorKey("");
    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
        const code = payload?.error?.code;
        // 401 iki fərqli şey ola bilər: yanlış şifrə və ya bitmiş sessiya.
        setErrorKey(
          code === "INVALID_CREDENTIALS" ? "deleteAccount.wrongPassword"
            : response.status === 401 ? "deleteAccount.sessionExpired"
              : code === "ADMIN_SELF_DELETE_FORBIDDEN" ? "deleteAccount.adminBody"
                : "deleteAccount.failed",
        );
        setBusy(false);
        return;
      }
      // Sessiya artıq etibarsızdır — tam yenidən yükləmə ilə çıxış edirik.
      window.location.href = "/";
    } catch {
      setErrorKey("deleteAccount.failed");
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="danger-zone-title">
      <header>
        <span className="danger-zone__icon" aria-hidden="true">
          <AlertTriangle size={17} />
        </span>
        <div>
          <strong id="danger-zone-title">{t("deleteAccount.title")}</strong>
          <small>{t("deleteAccount.body")}</small>
        </div>
        {!open ? (
          <button type="button" className="danger-zone__open" onClick={() => setOpen(true)}>
            {t("deleteAccount.open")}
          </button>
        ) : null}
      </header>

      {open ? (
        <form method="post" onSubmit={(event) => void submit(event)}>
          <label htmlFor="delete-account-password">
            {t("deleteAccount.password")}
            <input
              id="delete-account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              disabled={busy}
            />
          </label>

          {errorKey ? (
            <p className="danger-zone__error" role="alert">
              {t(errorKey)}
            </p>
          ) : null}

          <div className="danger-zone__actions">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setErrorKey("");
              }}
              disabled={busy}
            >
              {t("deleteAccount.cancel")}
            </button>
            <button type="submit" className="is-danger" disabled={busy || password.length < 8}>
              <Trash2 size={15} aria-hidden="true" />
              {busy ? t("deleteAccount.deleting") : t("deleteAccount.submit")}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

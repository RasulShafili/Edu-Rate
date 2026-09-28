"use client";

import { Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useT } from "../i18n/LanguageProvider";
import { LEGAL_CONTACT_EMAIL } from "../legal/version";
import { bakuDateParts } from "../lib/date";
import { useAuth } from "./AuthProvider";
import { openCookieSettings } from "./CookieConsent";

/**
 * Məxfilik parametrləri: fərdi məlumatların surətini yükləmək (tanış olmaq
 * hüququ), kuki seçimini dəyişmək və hüquqi sənədlərə keçid.
 */
export function PrivacyDataPanel() {
  const t = useT();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: string; error: boolean } | null>(null);

  async function download() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/account/export", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 429 ? "privacyData.rateLimited" : "privacyData.failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edurate-melumatlarim-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ key: "privacyData.ready", error: false });
    } catch (reason) {
      setMessage({ key: reason instanceof Error && reason.message.startsWith("privacyData.") ? reason.message : "privacyData.failed", error: true });
    } finally {
      setBusy(false);
    }
  }

  function acceptedLabel() {
    if (!user?.legalVersion) return null;
    const parts = bakuDateParts(`${user.legalVersion}T12:00:00+04:00`);
    return t("privacyData.version", { date: `${Number(parts.day)} ${t(`month.${parts.month}`)} ${parts.year}` });
  }

  return (
    <section className="settings-card privacy-data-panel" aria-labelledby="privacy-data-title">
      <div className="settings-intro">
        <h2 id="privacy-data-title"><ShieldCheck size={17} aria-hidden="true" /> {t("privacyData.title")}</h2>
        <p>{t("privacyData.body")}</p>
      </div>
      <div className="privacy-data-panel__actions">
        <button type="button" onClick={() => void download()} disabled={busy}>
          <Download size={15} aria-hidden="true" /> {t(busy ? "privacyData.preparing" : "privacyData.download")}
        </button>
        <button type="button" className="is-secondary" onClick={openCookieSettings}>{t("legalNav.cookieSettings")}</button>
      </div>
      {message ? <p className={`privacy-data-panel__message${message.error ? " is-error" : ""}`} role={message.error ? "alert" : "status"}>{t(message.key)}</p> : null}
      <p className="privacy-data-panel__meta">
        {acceptedLabel()}{acceptedLabel() ? " · " : ""}
        <Link href="/privacy">{t("legalNav.privacy")}</Link> · <Link href="/terms">{t("legalNav.terms")}</Link> · <Link href="/cookies">{t("legalNav.cookies")}</Link>
      </p>
      <p className="privacy-data-panel__meta">{t("privacyData.contact")} <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></p>
    </section>
  );
}

"use client";

import { ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "../i18n/LanguageProvider";
import { LEGAL_VERSION } from "../legal/version";
import type { UserProfile } from "../data/user";
import { useAuth } from "./AuthProvider";
import { BodyPortal } from "./ui/BodyPortal";

const LEGAL_PATHS = ["/privacy", "/terms", "/cookies", "/community-guidelines"];

/**
 * Hüquqi sənədlər yeniləndikdə mövcud istifadəçidən yenidən razılıq alınır.
 * Qəbul edilən versiya serverdə saxlanır; sənədləri oxumaq üçün hüquqi
 * səhifələrdə pəncərə göstərilmir.
 */
export function LegalConsentGate() {
  const t = useT();
  const pathname = usePathname();
  const { user, replaceUser, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  if (!user || user.legalVersion === LEGAL_VERSION || LEGAL_PATHS.includes(pathname)) return null;

  async function accept() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/auth/legal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, version: LEGAL_VERSION }),
      });
      const payload = (await response.json().catch(() => null)) as { data?: { user?: UserProfile } } | null;
      if (!response.ok || !payload?.data?.user) throw new Error();
      replaceUser(payload.data.user);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BodyPortal>
      <div className="legal-gate" role="presentation">
        <div className="legal-gate__dialog" role="dialog" aria-modal="true" aria-labelledby="legal-gate-title" aria-describedby="legal-gate-body">
          <span className="legal-gate__icon" aria-hidden="true"><ScrollText size={20} /></span>
          <h2 id="legal-gate-title">{t("legalGate.title")}</h2>
          <p id="legal-gate-body">{t("legalGate.body")}</p>
          <ul className="legal-gate__links">
            <li><Link href="/privacy" target="_blank">{t("legalNav.privacy")}</Link></li>
            <li><Link href="/terms" target="_blank">{t("legalNav.terms")}</Link></li>
            <li><Link href="/cookies" target="_blank">{t("legalNav.cookies")}</Link></li>
            <li><Link href="/community-guidelines" target="_blank">{t("legalNav.guidelines")}</Link></li>
          </ul>
          <label className="legal-gate__check">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>{t("legalGate.confirm")}</span>
          </label>
          {error ? <p className="legal-gate__error" role="alert">{t("legalGate.failed")}</p> : null}
          <div className="legal-gate__actions">
            <button type="button" className="legal-gate__secondary" onClick={() => void signOut()} disabled={busy}>{t("legalGate.signOut")}</button>
            <button type="button" className="legal-gate__primary" onClick={() => void accept()} disabled={!checked || busy}>
              {t(busy ? "legalGate.saving" : "legalGate.accept")}
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

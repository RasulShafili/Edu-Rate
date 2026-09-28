"use client";

import { Analytics } from "@vercel/analytics/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

/**
 * Çərəz razılığı + statistika.
 *
 * Sayt girişi saxlamaq üçün yalnız zəruri (httpOnly) çərəzdən istifadə edir —
 * ona razılıq tələb olunmur. Razılıq YALNIZ anonim ziyarət statistikasına aiddir:
 * istifadəçi "Qəbul et" deməyənə qədər `Analytics` ümumiyyətlə yüklənmir.
 *
 * GDPR-ə uyğun olaraq imtina qəbul qədər asandır (eyni ölçülü, yan-yana düymələr)
 * və seçim brauzerdə saxlanır, ona görə banner bir dəfə görünür.
 */

const STORAGE_KEY = "edurate-cookie-consent";
const OPEN_EVENT = "edurate:open-cookie-settings";
type Consent = "accepted" | "declined";

function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    // Şəxsi rejimdə localStorage bağlı ola bilər — banner sadəcə göstərilmir.
    return null;
  }
}

/** Razılığı geri götürmək qəbul etmək qədər asan olsun: footer və Ayarlardan banner yenidən açılır. */
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CookieConsent() {
  const t = useT();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // setState effektin içində birbaşa yox, taymerdə — lint qaydası (set-state-in-effect).
    const timer = window.setTimeout(() => {
      setConsent(readConsent());
      setReady(true);
    }, 0);
    const reopen = () => setConsent(null);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_EVENT, reopen);
    };
  }, []);

  function choose(value: Consent) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Yazmaq mümkün olmasa da seçim bu sessiyada tətbiq olunur.
    }
    setConsent(value);
  }

  // Server və ilk render eyni olsun deyə qərar verilənə qədər heç nə çıxarmırıq.
  if (!ready) return null;

  return (
    <>
      {consent === "accepted" ? <Analytics /> : null}

      {consent === null ? (
        <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title">
          <div>
            <strong id="cookie-consent-title">{t("cookie.title")}</strong>
            <p>
              {t("cookie.body")}{" "}
              <Link href="/cookies">{t("cookie.more")}</Link>
            </p>
          </div>
          <div className="cookie-consent__actions">
            <button type="button" onClick={() => choose("declined")}>
              {t("cookie.decline")}
            </button>
            <button type="button" className="is-primary" onClick={() => choose("accepted")}>
              {t("cookie.accept")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

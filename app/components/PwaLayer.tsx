"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "edurate:install-dismissed";

/**
 * Service worker qeydiyyatı və "ana ekrana əlavə et" təklifi.
 *
 * Service worker yalnız production-da qeydiyyatdan keçir — development-də
 * HMR ilə toqquşmaması üçün. Təklif banneri yalnız brauzer özü uyğun
 * olduğunu bildirəndə (beforeinstallprompt) görünür və rədd edilsə bir daha
 * çıxmır.
 */
export function PwaLayer() {
  const t = useT();
  const reduceMotion = Boolean(useReducedMotion());
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const register = () => {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      let dismissed = false;
      try {
        dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        dismissed = false;
      }
      if (dismissed) return;
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Yaddaş bağlıdırsa sadəcə bu sessiya üçün gizlədilir.
    }
  }

  async function install() {
    if (!installEvent) return;
    setVisible(false);
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="install-banner"
          role="dialog"
          aria-label={t("pwa.installTitle")}
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <span className="install-banner__icon" aria-hidden="true"><Download size={18} /></span>
          <div>
            <strong>{t("pwa.installTitle")}</strong>
            <small>{t("pwa.installBody")}</small>
          </div>
          <button type="button" className="install-banner__cta" onClick={() => void install()}>{t("pwa.install")}</button>
          <button type="button" className="install-banner__close" onClick={dismiss} aria-label={t("pwa.dismiss")}>
            <X size={16} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

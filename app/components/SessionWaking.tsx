"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

const GIVE_UP_AFTER_MS = 120_000;

/**
 * Server sessiyanı yoxlaya bilmədi (Render-in pulsuz planı boş qalanda backend-i
 * yatırır, oyanması 30–60 saniyə çəkir). Əvvəl bu hal "çıxış edib" sayılırdı və
 * daxil olmuş istifadəçi /auth-a atılırdı. İndi gözləyirik: sessiya gələndə
 * səhifə yenilənir, backend sessiyanı rədd edərsə giriş səhifəsinə keçirik.
 */
export function SessionWaking() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [gaveUp, setGaveUp] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const startedAt = Date.now();
    async function check() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (response.ok || response.status === 401) {
          const payload = (await response.json().catch(() => null)) as { data?: { user?: unknown } } | null;
          if (cancelled) return;
          if (response.ok && payload?.data?.user) router.refresh();
          else router.replace(`/auth?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
      } catch {
        // Şəbəkə xətası: backend hələ oyanır — yenidən yoxlayırıq.
      }
      if (cancelled) return;
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        setGaveUp(true);
        return;
      }
      timer = window.setTimeout(check, 3_000);
    }
    timer = window.setTimeout(check, 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt, pathname, router]);

  return (
    <section className="profile-section profile-empty-section" aria-labelledby="session-waking-title">
      <div className="profile-empty-card" role="status" aria-live="polite">
        <span className="profile-empty-mark" aria-hidden="true">
          {gaveUp ? <RefreshCw size={20} /> : <LoaderCircle size={20} className="is-spinning" />}
        </span>
        <span className="profile-kicker">{t("session.waking.eyebrow")}</span>
        <h1 id="session-waking-title">{t(gaveUp ? "session.waking.failedTitle" : "session.waking.title")}</h1>
        <p>{t(gaveUp ? "session.waking.failedText" : "session.waking.text")}</p>
        {gaveUp && (
          <button
            type="button"
            className="profile-empty-action"
            onClick={() => {
              setGaveUp(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t("common.retry")}
          </button>
        )}
      </div>
    </section>
  );
}

"use client";

import { MonitorSmartphone, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type Session = {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
};

type LoadState = "loading" | "ready" | "error";

/**
 * "Mozilla/5.0 (Windows NT 10.0; …) Chrome/… Safari/…" kimi xam sətri
 * insanın tanıya biləcəyi "Chrome · Windows" formasına salır.
 */
export function describeUserAgent(userAgent: string) {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
      : /Firefox\//.test(ua) ? "Firefox"
        : /Chrome\//.test(ua) ? "Chrome"
          : /Safari\//.test(ua) ? "Safari"
            : "";
  const os = /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
      : /iPhone|iPad|iOS/.test(ua) ? "iOS"
        : /Mac OS X|Macintosh/.test(ua) ? "macOS"
          : /Linux/.test(ua) ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ");
}

/**
 * Siyahı yalnız brauzerdə (açılanda) render olunur, ona görə istifadəçinin
 * yerli vaxtı işlədilir. Ay adı lüğətdən gəlir: `toLocaleString("az-AZ")`
 * bəzi Chromium qurğularında ay adlarını vermir.
 */
function localDateTime(iso: string, months: string[]) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getDate()} ${months[date.getMonth()]} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function SessionManager() {
  const t = useT();
  const [items, setItems] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [messageKey, setMessageKey] = useState("");
  const months = Array.from({ length: 12 }, (_, index) => t(`month.${index + 1}`));

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/auth/actions/sessions", { cache: "no-store" });
      if (!response.ok) {
        // Əvvəl xəta "Aktiv sessiya tapılmadı" kimi görünürdü.
        if (response.status === 401) setMessageKey("sessions.expired");
        setState("error");
        return;
      }
      const payload = (await response.json()) as { data?: Session[] };
      setItems(payload.data ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [open, load]);

  async function closeOthers() {
    setMessageKey("");
    try {
      const response = await fetch("/api/auth/actions/sessions", { method: "DELETE" });
      setMessageKey(response.ok ? "sessions.closedOthers" : response.status === 401 ? "sessions.expired" : "sessions.closeOthersFailed");
      if (response.ok) void load();
    } catch {
      setMessageKey("sessions.closeOthersFailed");
    }
  }

  async function closeOne(id: string) {
    setMessageKey("");
    try {
      const response = await fetch(`/api/auth/actions/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (response.ok) void load();
      else setMessageKey(response.status === 401 ? "sessions.expired" : "sessions.closeOneFailed");
    } catch {
      setMessageKey("sessions.closeOneFailed");
    }
  }

  return (
    <section className="profile-security-card" aria-labelledby="profile-security-title">
      <div>
        <span aria-hidden="true"><ShieldCheck size={18} /></span>
        <div>
          <small>{t("sessions.eyebrow")}</small>
          <h2 id="profile-security-title">{t("sessions.title")}</h2>
          <p>{t("sessions.body")}</p>
        </div>
      </div>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? <X size={15} aria-hidden="true" /> : <MonitorSmartphone size={15} aria-hidden="true" />}
        {open ? t("sessions.hide") : t("sessions.show")}
      </button>
      {open ? (
        <div className="profile-session-list">
          {state === "loading" ? <p>{t("sessions.loading")}</p> : null}
          {state === "error" ? (
            <p role="alert">
              {t("sessions.loadFailed")}{" "}
              <button type="button" className="question-inline-retry" onClick={() => void load()}>{t("sessions.retry")}</button>
            </p>
          ) : null}
          {state === "ready" ? items.map((item) => (
            <article key={item.id}>
              <MonitorSmartphone size={17} aria-hidden="true" />
              <div>
                <strong>{item.current ? t("sessions.current") : t("sessions.other")}</strong>
                <small>
                  {describeUserAgent(item.userAgent) || t("sessions.unknownBrowser")} ·{" "}
                  {t("sessions.lastSeen", { date: localDateTime(item.lastSeenAt, months) })}
                </small>
              </div>
              {!item.current ? (
                <button type="button" onClick={() => void closeOne(item.id)} aria-label={t("sessions.closeOne")}>
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </article>
          )) : null}
          {state === "ready" && !items.length ? <p>{t("sessions.empty")}</p> : null}
          {/* Yalnız bu cihaz aktivdirsə "digər cihazlardan çıx" heç nə etmirdi. */}
          {state === "ready" && items.some((item) => !item.current) ? (
            <button type="button" className="profile-close-sessions" onClick={() => void closeOthers()}>
              <RefreshCw size={14} aria-hidden="true" /> {t("sessions.closeOthers")}
            </button>
          ) : null}
          <div aria-live="polite">{messageKey ? <p role="status">{t(messageKey)}</p> : null}</div>
        </div>
      ) : null}
    </section>
  );
}

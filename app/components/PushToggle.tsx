"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type State = "checking" | "unsupported" | "disabled" | "off" | "on" | "denied";

/** base64url VAPID açarını brauzerin gözlədiyi Uint8Array formatına çevirir. */
function toKeyBytes(base64: string) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

const HINT_KEYS: Record<State, string> = {
  checking: "push.checking",
  unsupported: "push.unsupported",
  disabled: "push.disabled",
  denied: "push.denied",
  off: "push.body",
  on: "push.body",
};

/**
 * Cihaz bildirişləri açarı.
 *
 * Server VAPID açarı təqdim etməyibsə (push konfiqurasiya olunmayıb) bunu açıq
 * deyir. Əvvəl belə halda komponent heç nə göstərmirdi və Parametrlərdə yalnız
 * heç nəyi idarə etməyən açarlar qalırdı.
 */
export function PushToggle() {
  const t = useT();
  const [state, setState] = useState<State>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageKey, setMessageKey] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supported = typeof window !== "undefined"
        && "serviceWorker" in navigator
        && "PushManager" in window
        && "Notification" in window;
      if (!supported) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const response = await fetch("/api/push", { cache: "no-store" });
        const payload = await response.json() as { data?: { publicKey: string | null } };
        const key = payload.data?.publicKey ?? null;
        if (cancelled) return;
        if (!key) {
          setState("disabled");
          return;
        }
        setPublicKey(key);
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const registration = await navigator.serviceWorker.getRegistration();
        const existing = await registration?.pushManager.getSubscription();
        if (!cancelled) setState(existing ? "on" : "off");
      } catch {
        if (!cancelled) setState("disabled");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    setMessageKey("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKeyBytes(publicKey),
      });
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) {
        setMessageKey("push.saveFailed");
        return;
      }
      setState("on");
      setMessageKey("push.enabled");
    } catch {
      setMessageKey("push.enableFailed");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessageKey("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessageKey("push.disabledDone");
    } catch {
      setMessageKey("push.disableFailed");
    } finally {
      setBusy(false);
    }
  }

  const actionable = state === "on" || state === "off";

  return (
    <div className="push-toggle">
      <span className="push-toggle__icon" aria-hidden="true"><BellRing size={17} /></span>
      <div>
        <strong>{t("push.title")}</strong>
        <small>{t(HINT_KEYS[state])}</small>
        {messageKey ? <em role="status">{t(messageKey)}</em> : null}
      </div>
      {actionable ? (
        <button
          type="button"
          className={state === "on" ? "push-toggle__off" : "push-toggle__on"}
          onClick={() => void (state === "on" ? disable() : enable())}
          disabled={busy}
        >
          {busy ? t("push.wait") : state === "on" ? t("push.disable") : t("push.enable")}
        </button>
      ) : null}
    </div>
  );
}

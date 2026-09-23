"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, Sparkles, X, CalendarPlus, Share2} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Event } from "../data/events";
import { useT } from "../i18n/LanguageProvider";
import { bakuDateParts, getDeadlineStatus, getTemporalStatus } from "../lib/date";
import { useAuth } from "./AuthProvider";

/** Qeydiyyat xətası backend kodundan tərcümə açarına; mətn azərbaycanca gəlirdi. */
const REGISTRATION_ERRORS: Record<string, string> = {
  EVENT_FULL: "events.error.full",
  REGISTRATION_CLOSED: "events.error.closed",
  ALREADY_REGISTERED: "events.error.already",
  EVENT_NOT_PUBLISHED: "events.error.notPublished",
  EVENT_NOT_FOUND: "events.error.notFound",
  REGISTRATION_NOT_FOUND: "events.error.registrationNotFound",
};

function registrationErrorKey(status: number, code: string | undefined, fallback: string) {
  if (status === 401) return "admin.error.session";
  return (code && REGISTRATION_ERRORS[code]) || fallback;
}

class RegistrationError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(key);
    this.key = key;
  }
}

type EventDrawerProps = {
  event: Event | null;
  onClose: () => void;
};

export function EventDrawer({ event, onClose }: EventDrawerProps) {
  const t = useT();
  const { user } = useAuth();
  const userId = user?.id;
  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(() => new Set());
  const [availableSpotsByEvent, setAvailableSpotsByEvent] = useState<Record<string, number>>({});
  const [loadedRegistrationUserId, setLoadedRegistrationUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationFeedback, setRegistrationFeedback] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const availableSpots = event ? availableSpotsByEvent[event.id] ?? event.availableSpots : 0;
  const registrationOpen = event
    ? getDeadlineStatus(event.registrationDeadline) === "open" && availableSpots > 0 && getTemporalStatus(event.startAt, event.endAt) !== "finished"
    : false;
  const isRegistered = event ? registeredEventIds.has(event.id) : false;
  const isRegistrationStateLoading = Boolean(userId && loadedRegistrationUserId !== userId);
  const startParts = event ? bakuDateParts(event.startAt) : null;
  const startDate = startParts ? `${startParts.day} ${t(`month.${startParts.month}`)} ${startParts.year}` : "";

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();

    void fetch("/api/events/registrations", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as {
          data?: Array<{ id: string; availableSpots: number }>;
          error?: { code?: string };
        } | null;
        if (!response.ok || !payload) throw new RegistrationError(registrationErrorKey(response.status, payload?.error?.code, "events.error.registrationsLoad"));
        const registrations = payload.data ?? [];
        setRegisteredEventIds(new Set(registrations.map((item) => item.id)));
        setAvailableSpotsByEvent(Object.fromEntries(registrations.map((item) => [item.id, item.availableSpots])));
        setLoadedRegistrationUserId(userId);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRegistrationError(error instanceof RegistrationError ? error.key : "events.error.registrationsLoad");
        setLoadedRegistrationUserId(userId);
      });

    return () => controller.abort();
  }, [userId]);

  async function toggleRegistration() {
    if (!event || isSubmitting) return;
    setIsSubmitting(true);
    setRegistrationError("");
    setRegistrationFeedback("");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/registrations`, {
        method: isRegistered ? "DELETE" : "POST",
      });
      const payload = await response.json().catch(() => null) as {
        data?: { registered: boolean; event: { id: string; availableSpots: number } };
        error?: { code?: string };
      } | null;
      if (!response.ok) throw new RegistrationError(registrationErrorKey(response.status, payload?.error?.code, "events.error.register"));
      setRegisteredEventIds((current) => {
        const next = new Set(current);
        if (isRegistered) next.delete(event.id);
        else next.add(event.id);
        return next;
      });
      const updatedEvent = payload?.data?.event;
      if (updatedEvent) {
        setAvailableSpotsByEvent((current) => ({
          ...current,
          [updatedEvent.id]: updatedEvent.availableSpots,
        }));
      }
      setRegistrationFeedback(isRegistered ? "events.drawer.withdrawn" : "events.drawer.registered");
    } catch (error) {
      setRegistrationError(error instanceof RegistrationError ? error.key : "events.error.register");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!event) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 350);

    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") onClose();
      if (keyEvent.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (keyEvent.shiftKey && document.activeElement === first) {
        keyEvent.preventDefault();
        last.focus();
      } else if (!keyEvent.shiftKey && document.activeElement === last) {
        keyEvent.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [event, onClose]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="drawer-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          role="presentation"
        >
          <motion.button
            type="button"
            className="drawer-backdrop"
            aria-label={t("events.drawer.close")}
            onClick={onClose}
          />

          <motion.aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-drawer-title"
            className="event-drawer"
            style={{
              "--event-accent": event.accent,
              "--event-glow": event.glow,
            } as CSSProperties}
            initial={reduceMotion ? { opacity: 0 } : { x: "105%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "105%" }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 155, damping: 24, mass: 0.8 }}
          >
            <div className="drawer-noise" aria-hidden="true" />
            <div className="drawer-topline">
              <span>{t("events.drawer.path", { category: t(`eventCategory.${event.category}`) })}</span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="drawer-close"
                aria-label={t("events.drawer.close")}
              >
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div
              className={`drawer-visual${event.imageUrl ? " has-image" : ""}`}
              style={event.imageUrl?{backgroundImage:`linear-gradient(135deg,rgba(8,37,31,.08),rgba(8,37,31,.5)),url("${event.imageUrl}")`}:undefined}
              aria-hidden="true"
            >
              {/* Əvvəl hər iki orb sonsuz fırlanırdı — dekorativ sonsuz animasiya olmasın. */}
              <div className="drawer-orb drawer-orb-one" />
              <div className="drawer-orb drawer-orb-two" />
              <Sparkles size={26} strokeWidth={1.25} />
            </div>

            <div className="drawer-content">
              <span className="drawer-kicker">{t("events.drawer.kicker")}</span>
              <h2 id="event-drawer-title">{event.title}</h2>
              <p className="drawer-description">{event.longDescription}</p>

              <div className="drawer-facts">
                <div>
                  <CalendarDays size={17} />
                  <span>{startDate}</span>
                </div>
                <div><Clock3 size={17} /><span>{event.time}</span></div>
                <div><MapPin size={17} /><span>{event.location}, {event.city}</span></div>
              </div>

              <div className="drawer-hosts">
                <span>{t("events.drawer.organizer")}</span>
                <p>{event.organizer}</p>
                <span>{t("events.drawer.speakers")}</span>
                <p>{event.speakers.join(" · ")}</p>
              </div>

              <div className="drawer-bottom">
                <span>{t("events.drawer.capacity", { capacity: event.capacity, spots: availableSpots })}</span>
                {registrationOpen || isRegistered ? (
                  user ? (
                    <button type="button" className={`reserve-button${isRegistered ? " is-registered" : ""}`} onClick={() => void toggleRegistration()} disabled={isSubmitting || isRegistrationStateLoading}>
                      {t(isRegistrationStateLoading ? "events.drawer.checking" : isSubmitting ? (isRegistered ? "events.drawer.withdrawing" : "events.drawer.registering") : isRegistered ? "events.drawer.withdraw" : "events.drawer.register")}
                      {isRegistered ? <Check size={17} /> : <ArrowRight size={17} />}
                    </button>
                  ) : (
                    <Link className="reserve-button" href="/auth?returnTo=%2Fevents">
                      {t("events.drawer.signIn")} <ArrowRight size={17} />
                    </Link>
                  )
                ) : (
                  <span className="event-registration-closed">{t("events.registrationClosed")}</span>
                )}
              </div>
              <div className="drawer-share-row">
                <a
                  className="calendar-download"
                  href={`/api/events/${encodeURIComponent(event.id)}/calendar`}
                  download
                >
                  <CalendarPlus size={15} aria-hidden="true" /> {t("events.drawer.calendar")}
                </a>
                <a
                  className="calendar-download"
                  href={`/api/events/${encodeURIComponent(event.id)}/share`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Share2 size={15} aria-hidden="true" /> {t("events.drawer.share")}
                </a>
              </div>
              {registrationError && <p className="event-registration-error" role="alert">{t(registrationError)}</p>}
              <span className="sr-only" aria-live="polite">{registrationFeedback ? t(registrationFeedback) : ""}</span>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

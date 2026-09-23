"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, MapPin } from "lucide-react";
import { type CSSProperties } from "react";
import type { Event } from "../data/events";
import { useLanguage } from "../i18n/LanguageProvider";
import { getDeadlineStatus, getTemporalStatus } from "../lib/date";

type EventCardProps = {
  event: Event;
  index: number;
  onSelect: (event: Event) => void;
};

export function EventCard({ event, index, onSelect }: EventCardProps) {
  const { language, t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const temporalStatus = getTemporalStatus(event.startAt, event.endAt);
  const registrationOpen = getDeadlineStatus(event.registrationDeadline) === "open" && event.availableSpots > 0 && temporalStatus !== "finished";

  return (
    <motion.article
      layout
      layoutId={`card-${event.id}`}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{
        layout: { type: "spring", stiffness: 210, damping: 26 },
        opacity: { duration: 0.35, delay: index * 0.035 },
        y: { duration: 0.42, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] },
      }}
      className="event-card group"
    >
      <button
        type="button"
        onClick={() => onSelect(event)}
        className="event-card-button"
        aria-label={t("events.card.open", { title: event.title })}
      >
        <div
          className={`event-art${event.imageUrl ? " has-image" : ""}`}
          style={{
            "--event-accent": event.accent,
            "--event-glow": event.glow,
            ...(event.imageUrl ? { "--event-image": `url("${event.imageUrl}")` } : {}),
          } as CSSProperties}
        >
          <div className="event-art-orbit event-art-orbit-one" />
          <div className="event-art-orbit event-art-orbit-two" />
          <div className="event-art-core" />
          <span className="event-category">{t(`eventCategory.${event.category}`)}</span>
          <span className="event-time">{event.time}</span>
        </div>

        <div className="event-card-content">
          <div
            className="event-date"
            aria-label={`${event.date} ${t(`month.${event.monthIndex}`)}`}
          >
            <span>{event.date}</span>
            <small>{t(`monthShort.${event.monthIndex}`).toLocaleUpperCase(language)}</small>
          </div>
          <div className="event-copy">
            <div className="event-title-row">
              <h3>{event.title}</h3>
              <span className="event-arrow" aria-hidden="true">
                <ArrowUpRight size={18} strokeWidth={1.8} />
              </span>
            </div>
            <p>{event.description}</p>
            <span className={`event-registration-status${registrationOpen ? " is-open" : " is-closed"}`}>
              {registrationOpen
                ? t("events.spotsLeft", { count: event.availableSpots })
                : t(temporalStatus === "finished" ? "events.finished" : "events.registrationClosed")}
            </span>
            <span className="event-location">
              <MapPin size={13} strokeWidth={1.8} aria-hidden="true" />
              {event.city} · {event.location}
            </span>
            <span className="event-organizer">{event.organizer}</span>
            <span className="event-primary-action">{t("events.more")}</span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

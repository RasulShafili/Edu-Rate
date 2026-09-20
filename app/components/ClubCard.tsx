"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CalendarDays, UsersRound } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Club } from "../data/clubs";
import { useT } from "../i18n/LanguageProvider";

type ClubCardProps = {
  club: Club;
  index: number;
};

/**
 * Kart kursorla hərəkət etmir.
 *
 * Əvvəl burada kursorun yerinə görə şəkli və mətni ayrı-ayrı sürüşdürən,
 * üstəlik fırladan parallaks var idi. Sayt boyu 3D və dekorativ hərəkət
 * ləğv edilib, ona görə kart yalnız görünəndə bir dəfə sadə şəkildə açılır.
 */
export function ClubCard({ club, index }: ClubCardProps) {
  const reducedMotion = useReducedMotion();
  const t = useT();

  return (
    <motion.article
      className="club-directory-card"
      data-tone={club.tone}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: 0.32,
              delay: Math.min(index * 0.035, 0.14),
              ease: [0.22, 1, 0.36, 1],
            }
      }
      style={{ "--club-sequence": index + 1 } as CSSProperties}
    >
      <Link
        href={`/clubs/${club.slug}`}
        className="club-directory-link"
        aria-label={t("clubs.cardGoTo", { name: club.name })}
      >
        <div className={`club-card-visual${club.coverUrl ? " has-cover" : ""}`} style={club.coverUrl ? { "--club-cover-image": `url("${club.coverUrl}")` } as CSSProperties : undefined} aria-hidden="true">
          <div className="club-card-art">
            <span className="club-card-art-grid" />
            <span className="club-card-art-orbit club-card-art-orbit-primary" />
            <span className="club-card-art-orbit club-card-art-orbit-secondary" />
            <span className="club-card-art-glow" />
            <span className="club-card-visual-mark"><UsersRound size={34} strokeWidth={1.35} /></span>
          </div>
          <span className="club-card-visual-label">{t("clubs.cardLabel")}</span>
        </div>

        <div className="club-card-content">
          <div className="club-card-topline">
            <span className="club-card-category">{t(`clubCategory.${club.category}`)}</span>
            <span className="club-card-arrow" aria-hidden="true">
              <ArrowUpRight size={20} strokeWidth={1.7} />
            </span>
          </div>

          <div className="club-card-copy">
            <h2>{club.name}</h2>
            <p className="club-card-tagline">{club.tagline}</p>
          </div>

          <div className="club-card-footer">
            <div className="club-card-meta">
              <span>
                <UsersRound size={15} strokeWidth={1.7} aria-hidden="true" />
                {club.stats[0]?.value ?? "—"} {t("clubs.members")}
              </span>
              <span>
                <CalendarDays size={15} strokeWidth={1.7} aria-hidden="true" />
                {club.meeting.cadence}
              </span>
            </div>
            <span className="club-card-action">{t("clubs.cardView")} <ArrowUpRight size={15} aria-hidden="true" /></span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useT } from "../i18n/LanguageProvider";
import { ArrowUpRight, Check, Star } from "lucide-react";
import { useRef, type CSSProperties, type RefObject } from "react";
import type { Teacher } from "../types/professionals";
import { formatDecimalScore } from "../lib/number-format";
import { TeacherSilhouette } from "./TeacherSilhouette";

type TeacherCardProps = {
  teacher: Teacher;
  index: number;
  isRatingTarget: boolean;
  isProfileOpen: boolean;
  disabled: boolean;
  scrollContainer: RefObject<HTMLDivElement | null>;
  onOpenProfile: (teacher: Teacher) => void;
};

export function TeacherCard({
  teacher,
  index,
  isRatingTarget,
  isProfileOpen,
  disabled,
  scrollContainer,
  onOpenProfile,
}: TeacherCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { scrollXProgress } = useScroll({
    container: scrollContainer,
    target: cardRef,
    axis: "x",
    offset: ["start end", "end start"],
  });
  const portraitX = useTransform(scrollXProgress, [0, 1], [-10, 10]);
  const portraitScale = useTransform(scrollXProgress, [0, 0.5, 1], [1.08, 1.02, 1.08]);

  return (
    <motion.article
      ref={cardRef}
      className={`teacher-card${isRatingTarget ? " is-selected" : ""}`}
      role="listitem"
      style={{
        "--teacher-accent": teacher.accent,
        "--teacher-glow": teacher.glow,
      } as CSSProperties}
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.button
        type="button"
        className="teacher-card-trigger"
        onClick={() => onOpenProfile(teacher)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isProfileOpen}
        aria-controls="teacher-profile-dialog"
        aria-label={`${t("teachers.openProfileAria", { name: teacher.name, subject: teacher.subject })}${isRatingTarget ? t("teachers.selectedSuffix") : ""}`}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      >
        <span className="teacher-avatar" aria-hidden="true">
          <motion.span
            className="teacher-avatar-source"
            style={{
              x: reduceMotion ? 0 : portraitX,
              scale: reduceMotion ? 1.03 : portraitScale,
            }}
          >
            <TeacherSilhouette />
          </motion.span>
          <i className="teacher-avatar-orbit" />
        </span>

        <span className="teacher-card-summary">
          <span className="teacher-subject">{teacher.subject}</span>
          <strong>{teacher.name}</strong>
          <span className="teacher-card-rating">
            {teacher.reviewCount > 0 ? (
              <>
                <Star size={12} fill="currentColor" />
                {formatDecimalScore(teacher.rating)}
                <small>{teacher.reviewCount} rəy</small>
              </>
            ) : <small>{t("teachers.newProfile")}</small>}
          </span>
        </span>

        <span className="teacher-profile-arrow" aria-hidden="true">
          {isRatingTarget ? <Check size={15} /> : <ArrowUpRight size={16} />}
        </span>
      </motion.button>
    </motion.article>
  );
}

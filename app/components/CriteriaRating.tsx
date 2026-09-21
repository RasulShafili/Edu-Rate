"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useT } from "../i18n/LanguageProvider";
import {
  useId,
  useRef,
  type KeyboardEvent,
} from "react";
import { formatDecimalScore } from "../lib/number-format";

/**
 * Meyarlar üzrə qiymətləndirmə.
 *
 * QEYD: bu komponent əvvəl köhnə TÜND tema üçün yazılmışdı — mətn və sərhədlər
 * ağa yaxın sabit rənglər idi (`rgba(243,241,233,…)`, `border-white/10`), ona görə
 * işıqlı kartın üzərində 1–5 düymələri demək olar görünmürdü. İndi bütün rənglər
 * dizayn tokenlərindən gəlir.
 *
 * Animasiya və emoji YALNIZ bu bölmədədir: istifadəçi qiymət verərkən dərhal
 * canlı geribildirim alsın deyə. Saytın qalan hissəsi sakit qalır.
 */

export type ReviewCriterionKey =
  | "clarity"
  | "subjectKnowledge"
  | "objectivity"
  | "communication";

export type CriterionRating = 0 | 1 | 2 | 3 | 4 | 5;

export type CriteriaRatings = Record<ReviewCriterionKey, CriterionRating>;

/** Dəyərlər tərcümə açarıdır — istifadə yerində `t()` ilə açılır. */
export const criteriaLabels: Record<ReviewCriterionKey, string> = {
  clarity: "rating.clarity",
  subjectKnowledge: "rating.subjectKnowledge",
  objectivity: "rating.objectivity",
  communication: "rating.communication",
};

export const defaultCriteriaRatings: Readonly<CriteriaRatings> = Object.freeze({
  clarity: 0,
  subjectKnowledge: 0,
  objectivity: 0,
  communication: 0,
});

const criteriaDescriptions: Record<ReviewCriterionKey, string> = {
  clarity: "rating.clarityHint",
  subjectKnowledge: "rating.subjectKnowledgeHint",
  objectivity: "rating.objectivityHint",
  communication: "rating.communicationHint",
};

/** Hər bal üçün emoji + söz. Emoji bəzəkdir (aria-hidden), mənanı söz daşıyır. */
const ratingFeedback: Record<Exclude<CriterionRating, 0>, { emoji: string; label: string }> = {
  1: { emoji: "😕", label: "rating.score1" },
  2: { emoji: "🙂", label: "rating.score2" },
  3: { emoji: "😊", label: "rating.score3" },
  4: { emoji: "😃", label: "rating.score4" },
  5: { emoji: "🤩", label: "rating.score5" },
};

const criterionKeys = Object.keys(criteriaLabels) as ReviewCriterionKey[];
const ratingOptions = [1, 2, 3, 4, 5] as const;

export function calculateCriteriaAverage(ratings: CriteriaRatings) {
  const selectedRatings = criterionKeys
    .map((key) => ratings[key])
    .filter((rating): rating is Exclude<CriterionRating, 0> => rating > 0);

  if (selectedRatings.length === 0) return 0;
  const total = selectedRatings.reduce((sum, rating) => sum + rating, 0);
  return Number((total / selectedRatings.length).toFixed(1));
}

export function areCriteriaComplete(ratings: CriteriaRatings) {
  return criterionKeys.every((key) => ratings[key] > 0);
}

/** Orta bala görə ümumi emoji — yuvarlaqlaşdırılmış qiymət. */
function averageFeedback(average: number) {
  if (average <= 0) return null;
  const rounded = Math.max(1, Math.min(5, Math.round(average))) as Exclude<CriterionRating, 0>;
  return ratingFeedback[rounded];
}

type CriteriaRatingProps = {
  value: CriteriaRatings;
  onChange: (ratings: CriteriaRatings) => void;
  teacherName?: string;
  disabled?: boolean;
  className?: string;
};

type CriterionRowProps = {
  criterion: ReviewCriterionKey;
  value: CriterionRating;
  onChange: (rating: Exclude<CriterionRating, 0>) => void;
  teacherName?: string;
  disabled: boolean;
  rowId: string;
  reduceMotion: boolean;
};

function getNextRating(key: string, current: number) {
  if (key === "ArrowRight" || key === "ArrowUp") return Math.min(5, current + 1);
  if (key === "ArrowLeft" || key === "ArrowDown") return Math.max(1, current - 1);
  if (key === "Home") return 1;
  if (key === "End") return 5;
  return null;
}

function CriterionRow({
  criterion,
  value,
  onChange,
  teacherName,
  disabled,
  rowId,
  reduceMotion,
}: CriterionRowProps) {
  const t = useT();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const legendId = `${rowId}-legend`;
  const descriptionId = `${rowId}-description`;
  const feedback = value > 0 ? ratingFeedback[value as Exclude<CriterionRating, 0>] : null;
  const pop = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 460, damping: 24, mass: 0.5 };

  function handleKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    currentRating: Exclude<CriterionRating, 0>,
  ) {
    const nextRating = getNextRating(event.key, currentRating);
    if (nextRating === null) return;

    event.preventDefault();
    const rating = nextRating as Exclude<CriterionRating, 0>;
    onChange(rating);
    buttonRefs.current[rating - 1]?.focus();
  }

  return (
    <fieldset className="criteria-row" disabled={disabled}>
      <legend id={legendId} className="criteria-row__label">
        {t(criteriaLabels[criterion])}
      </legend>

      <div className="criteria-row__body">
        <p id={descriptionId} className="criteria-row__hint">
          {t(criteriaDescriptions[criterion])}
        </p>

        <div className="criteria-row__scale">
          <div
            className="criteria-row__options"
            role="radiogroup"
            aria-labelledby={legendId}
            aria-describedby={descriptionId}
          >
            {ratingOptions.map((rating) => {
              const selected = value === rating;
              const buttonLabel = t(teacherName ? "rating.dotAriaTeacher" : "rating.dotAria", {
                teacher: teacherName ?? "",
                criterion: t(criteriaLabels[criterion]),
                rating,
                label: t(ratingFeedback[rating].label),
              });

              return (
                <motion.button
                  key={rating}
                  ref={(node) => {
                    buttonRefs.current[rating - 1] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={buttonLabel}
                  tabIndex={selected || (value === 0 && rating === 1) ? 0 : -1}
                  disabled={disabled}
                  className={`criteria-dot${selected ? " is-selected" : ""}`}
                  animate={selected && !reduceMotion ? { scale: [1, 1.22, 1] } : { scale: 1 }}
                  // Eyni sebeb: uc kadr spring qebul etmir.
                  whileHover={disabled || reduceMotion ? undefined : { scale: 1.12, y: -2 }}
                  whileTap={disabled || reduceMotion ? undefined : { scale: 0.9 }}
                  transition={selected && !reduceMotion ? { duration: 0.26, ease: "easeOut" } : pop}
                  onClick={() => onChange(rating)}
                  onKeyDown={(event) => handleKeyboard(event, rating)}
                >
                  {rating}
                </motion.button>
              );
            })}
          </div>

          {/* Seçilən bala uyğun emoji + söz; bal dəyişəndə yenisi yumşaq gəlir. */}
          <div className="criteria-row__feedback" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {feedback ? (
                <motion.span
                  key={value}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                  transition={pop}
                >
                  <i aria-hidden="true">{feedback.emoji}</i>
                  {t(feedback.label)}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

export function CriteriaRating({
  value,
  onChange,
  teacherName,
  disabled = false,
  className = "",
}: CriteriaRatingProps) {
  const t = useT();
  const id = useId().replace(/:/gu, "");
  const reduceMotion = Boolean(useReducedMotion());
  const average = calculateCriteriaAverage(value);
  const selectedCount = criterionKeys.filter((key) => value[key] > 0).length;
  const complete = selectedCount === criterionKeys.length;
  const summary = averageFeedback(average);

  function updateCriterion(
    criterion: ReviewCriterionKey,
    rating: Exclude<CriterionRating, 0>,
  ) {
    onChange({ ...value, [criterion]: rating });
  }

  return (
    <section className={`criteria-rating-shell ${className}`.trim()} aria-labelledby={`${id}-title`}>
      <header className="criteria-head">
        <div>
          <p className="criteria-head__eyebrow">{t("rating.eyebrow")}</p>
          <h3 id={`${id}-title`}>{t("rating.title")}</h3>
        </div>

        <motion.output
          className={`criteria-score${complete ? " is-complete" : ""}`}
          aria-label={
            average > 0
              ? t("rating.averageAria", { score: formatDecimalScore(average) })
              : t("rating.noScore")
          }
          aria-live="polite"
          animate={complete && !reduceMotion ? { scale: [1, 1.1, 1] } : { scale: 1 }}
          // Cox kadrli scale spring ile islemir (motion runtime-da atir), ona gore tween.
          transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: "easeOut" }}
        >
          <span className="criteria-score__emoji" aria-hidden="true">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={summary?.emoji ?? "empty"}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.5, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 28 }}
              >
                {summary?.emoji ?? "⭐"}
              </motion.span>
            </AnimatePresence>
          </span>
          <strong>{average > 0 ? formatDecimalScore(average) : "—"}</strong>
          <small>{t("rating.criteriaCount", { count: selectedCount })}</small>
        </motion.output>
      </header>

      <div className="criteria-list">
        {criterionKeys.map((criterion) => (
          <CriterionRow
            key={criterion}
            criterion={criterion}
            value={value[criterion]}
            onChange={(rating) => updateCriterion(criterion, rating)}
            teacherName={teacherName}
            disabled={disabled}
            rowId={`${id}-${criterion}`}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>

      {/* Nə qaldığını açıq deyirik — "göndər" düyməsinin niyə sönük olduğu aydın olsun. */}
      <AnimatePresence initial={false} mode="wait">
        {complete ? (
          <motion.p
            key="done"
            className="criteria-progress is-done"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          >
            <i aria-hidden="true">✅</i> {t("rating.ready")}
          </motion.p>
        ) : (
          <motion.p
            key="left"
            className="criteria-progress"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          >
            {t("rating.remaining", { count: criterionKeys.length - selectedCount })}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

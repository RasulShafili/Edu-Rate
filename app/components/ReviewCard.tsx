"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import type { TeacherReview } from "../types/professionals";
import { criteriaLabels, type ReviewCriterionKey } from "./CriteriaRating";
import { useT } from "../i18n/LanguageProvider";
import { formatDecimalScore } from "../lib/number-format";

type ReviewCardProps = {
  review: TeacherReview;
  index: number;
};

export function ReviewCard({ review, index }: ReviewCardProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const criterionScores = review.criteria
    ? (Object.entries(review.criteria) as Array<[ReviewCriterionKey, number]>)
    : [];

  return (
    <motion.article
      className={`review-card${review.featured ? " is-featured" : ""}`}
      style={{ "--review-accent": review.accent } as CSSProperties}
      initial={reduceMotion ? false : { opacity: 0, y: 34, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.62, delay: Math.min(index * 0.055, 0.32), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="review-topline">
        <span>{review.course}</span>
        <strong className="review-score-value">{formatDecimalScore(review.rating)} / 5</strong>
      </div>
      <div className="review-stars" aria-label={`${review.rating} ulduz`}> 
        {Array.from({ length: 5 }, (_, star) => (
          <Star key={star} size={12} fill={star < review.rating ? "currentColor" : "none"} />
        ))}
      </div>
      {criterionScores.length > 0 && (
        <dl className="review-criteria" aria-label="Qiymətləndirmə meyarları">
          {criterionScores.map(([criterion, score]) => (
            <div key={criterion}>
              <dt>{t(criteriaLabels[criterion])}</dt>
              <dd>{score}/5</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="review-author">
        <span>{review.initials}</span>
        <div>
          <strong>{review.author}</strong>
          <small>{review.teacherName} · {review.date}</small>
        </div>
      </div>
    </motion.article>
  );
}

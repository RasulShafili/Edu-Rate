"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, GraduationCap, Scale, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type Criteria = {
  clarity: number;
  subjectKnowledge: number;
  objectivity: number;
  communication: number;
};

type Teacher = {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  headline: string;
  experienceYears: number;
  meetingMode: string;
  languages: string[];
  rating: number;
  reviewCount: number;
  criteria: Criteria;
};

const CRITERIA: Array<{ key: keyof Criteria; label: string; hint: string }> = [
  { key: "clarity", label: "rating.clarity", hint: "rating.clarityHint" },
  { key: "subjectKnowledge", label: "rating.subjectKnowledge", hint: "rating.subjectKnowledgeHint" },
  { key: "objectivity", label: "rating.objectivity", hint: "rating.objectivityHint" },
  { key: "communication", label: "rating.communication", hint: "rating.communicationHint" },
];

const MAX_COMPARE = 3;

export function TeacherCompare() {
  const t = useT();
  const reduceMotion = Boolean(useReducedMotion());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  /** Xəta ilə boş nəticəni ayırmaq üçün: əvvəl hər ikisi "müəllim tapılmadı" idi. */
  const [failed, setFailed] = useState(false);
  const [subject, setSubject] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/catalog/teachers", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { data?: Teacher[] } | null;
        if (cancelled) return;
        if (!response.ok || !payload?.data) setFailed(true);
        else setTeachers(payload.data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const subjects = useMemo(
    () => [...new Set(teachers.map((teacher) => teacher.specialty).filter(Boolean))].sort((a, b) => a.localeCompare(b, "az")),
    [teachers],
  );

  const visible = useMemo(
    () => (subject === "all" ? teachers : teachers.filter((teacher) => teacher.specialty === subject)),
    [teachers, subject],
  );

  const selected = useMemo(
    () => picked.map((id) => teachers.find((teacher) => teacher.id === id)).filter((item): item is Teacher => Boolean(item)),
    [picked, teachers],
  );

  /** Hər meyar üzrə ən yüksək bal — müqayisədə lideri işarələmək üçün. */
  const leaders = useMemo(() => {
    const result: Partial<Record<keyof Criteria, number>> = {};
    for (const { key } of CRITERIA) {
      const best = Math.max(...selected.map((teacher) => teacher.criteria?.[key] ?? 0), 0);
      if (best > 0) result[key] = best;
    }
    return result;
  }, [selected]);

  function toggle(id: string) {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_COMPARE) return current;
      return [...current, id];
    });
  }

  const rated = selected.filter((teacher) => teacher.reviewCount > 0);

  return (
    <section className="compare-shell">
      <header className="section-heading">
        <div>
          <span>{t("compare.eyebrow")}</span>
          <h1 className="module-page-title">{t("compare.title")}</h1>
        </div>
        <Link href="/teachers" className="compare-back">{t("compare.allTeachers")}</Link>
      </header>

      <p className="compare-lead">{t("compare.lead")}</p>

      <div className="compare-filters">
        <label>
          {t("teachers.subject")}
          <select value={subject} onChange={(event) => { setSubject(event.target.value); setPicked([]); }}>
            <option value="all">{t("teachers.allSubjects")}</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <span className="compare-counter">{t("compare.selected", { count: picked.length, max: MAX_COMPARE })}</span>
      </div>

      {loading ? (
        <p className="chat-state">{t("compare.loading")}</p>
      ) : failed ? (
        <p className="compare-load-error" role="alert">{t("compare.loadFailed")}</p>
      ) : (
        <div className="compare-picker">
          {visible.map((teacher) => {
            const active = picked.includes(teacher.id);
            const full = !active && picked.length >= MAX_COMPARE;
            return (
              <button
                key={teacher.id}
                type="button"
                className={`compare-chip${active ? " is-active" : ""}`}
                onClick={() => toggle(teacher.id)}
                disabled={full}
                aria-pressed={active}
              >
                <span className="compare-chip__mark">{active ? <Check size={13} /> : <GraduationCap size={13} />}</span>
                <span>
                  <strong>{teacher.name}</strong>
                  <small>{teacher.specialty}</small>
                </span>
                <span className="compare-chip__score">
                  {teacher.reviewCount ? <><Star size={11} /> {teacher.rating.toFixed(1)}</> : t("compare.new")}
                </span>
              </button>
            );
          })}
          {visible.length === 0 ? <p className="week-day__empty">{t("compare.noneForSubject")}</p> : null}
        </div>
      )}

      {selected.length >= 2 ? (
        <motion.div
          className="compare-table"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="compare-table__head">
            <span className="compare-table__corner"><Scale size={15} /> {t("compare.criterion")}</span>
            {selected.map((teacher) => (
              <span key={teacher.id} className="compare-table__teacher">
                <strong>{teacher.name}</strong>
                <small>{teacher.reviewCount ? t("compare.reviewsCount", { count: teacher.reviewCount }) : t("compare.noReviews")}</small>
              </span>
            ))}
          </div>

          {rated.length === 0 ? (
            <p className="compare-empty-note">{t("compare.noApproved")}</p>
          ) : (
            CRITERIA.map((criterion) => (
              <div key={criterion.key} className="compare-row">
                <span className="compare-row__label">
                  <strong>{t(criterion.label)}</strong>
                  <small>{t(criterion.hint)}</small>
                </span>
                {selected.map((teacher) => {
                  const value = teacher.criteria?.[criterion.key] ?? 0;
                  const best = leaders[criterion.key];
                  const isLeader = Boolean(best && value === best && value > 0 && selected.length > 1);
                  return (
                    <span key={teacher.id} className={`compare-cell${isLeader ? " is-leader" : ""}`}>
                      <span className="compare-bar" aria-hidden="true">
                        <span style={{ width: `${(value / 5) * 100}%` }} />
                      </span>
                      <b>{value ? value.toFixed(1) : "—"}</b>
                    </span>
                  );
                })}
              </div>
            ))
          )}

          <div className="compare-row compare-row--meta">
            <span className="compare-row__label"><strong>{t("teachers.experience")}</strong><small>{t("compare.experienceHint")}</small></span>
            {selected.map((teacher) => <span key={teacher.id} className="compare-cell"><b>{t("compare.years", { count: teacher.experienceYears })}</b></span>)}
          </div>
          <div className="compare-row compare-row--meta">
            <span className="compare-row__label"><strong>{t("compare.format")}</strong><small>{t("compare.formatHint")}</small></span>
            {selected.map((teacher) => <span key={teacher.id} className="compare-cell"><b>{teacher.meetingMode}</b></span>)}
          </div>
        </motion.div>
      ) : (
        <div className="schedule-empty">
          <Scale size={28} />
          <h2>{t("compare.pickTitle")}</h2>
          <p>{t("compare.pickBody")}</p>
        </div>
      )}
    </section>
  );
}

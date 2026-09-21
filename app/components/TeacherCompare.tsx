"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, GraduationCap, Scale, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  { key: "clarity", label: "İzahın aydınlığı", hint: "Mövzunu nə qədər başa düşülən çatdırır" },
  { key: "subjectKnowledge", label: "Fənn biliyi", hint: "Sahəyə dərin hakimiyyəti" },
  { key: "objectivity", label: "Obyektivlik", hint: "Qiymətləndirmədə ədalətlilik" },
  { key: "communication", label: "Ünsiyyət", hint: "Sual vermək və cavab almaq rahatlığı" },
];

const MAX_COMPARE = 3;

export function TeacherCompare() {
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
          <span>Seçim köməkçisi</span>
          <h1 className="module-page-title">Hansı müəllimi seçim?</h1>
        </div>
        <Link href="/teachers" className="compare-back">Bütün müəllimlər</Link>
      </header>

      <p className="compare-lead">
        Fənni seç, sonra 2–3 müəllimi yan-yana müqayisə et. Ballar tələbələrin dörd pedaqoji meyar üzrə
        verdiyi təsdiqlənmiş rəylərdən hesablanır — şəxs haqqında deyil, dərsin keyfiyyəti haqqında.
      </p>

      <div className="compare-filters">
        <label>
          Fənn
          <select value={subject} onChange={(event) => { setSubject(event.target.value); setPicked([]); }}>
            <option value="all">Bütün fənlər</option>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <span className="compare-counter">{picked.length}/{MAX_COMPARE} seçilib</span>
      </div>

      {loading ? (
        <p className="chat-state">Müəllimlər yüklənir…</p>
      ) : failed ? (
        <p className="compare-load-error" role="alert">
          Müəllim kataloqu yüklənmədi. Server cavab vermədi — bir qədər sonra yenidən yoxla.
        </p>
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
                  {teacher.reviewCount ? <><Star size={11} /> {teacher.rating.toFixed(1)}</> : "yeni"}
                </span>
              </button>
            );
          })}
          {visible.length === 0 ? <p className="week-day__empty">Bu fənn üzrə müəllim tapılmadı.</p> : null}
        </div>
      )}

      {selected.length >= 2 ? (
        <motion.div
          className="compare-table"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="compare-table__head">
            <span className="compare-table__corner"><Scale size={15} /> Meyar</span>
            {selected.map((teacher) => (
              <span key={teacher.id} className="compare-table__teacher">
                <strong>{teacher.name}</strong>
                <small>{teacher.reviewCount ? `${teacher.reviewCount} rəy` : "rəy yoxdur"}</small>
              </span>
            ))}
          </div>

          {rated.length === 0 ? (
            <p className="compare-empty-note">
              Seçdiyin müəllimlər üçün hələ təsdiqlənmiş rəy yoxdur. Dərsi keçmisənsə, ilk rəyi sən yaza bilərsən.
            </p>
          ) : (
            CRITERIA.map((criterion) => (
              <div key={criterion.key} className="compare-row">
                <span className="compare-row__label">
                  <strong>{criterion.label}</strong>
                  <small>{criterion.hint}</small>
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
            <span className="compare-row__label"><strong>Təcrübə</strong><small>İllər üzrə</small></span>
            {selected.map((teacher) => <span key={teacher.id} className="compare-cell"><b>{teacher.experienceYears} il</b></span>)}
          </div>
          <div className="compare-row compare-row--meta">
            <span className="compare-row__label"><strong>Format</strong><small>Dərs keçmə üsulu</small></span>
            {selected.map((teacher) => <span key={teacher.id} className="compare-cell"><b>{teacher.meetingMode}</b></span>)}
          </div>
        </motion.div>
      ) : (
        <div className="schedule-empty">
          <Scale size={28} />
          <h2>Müqayisə üçün ən azı iki müəllim seç</h2>
          <p>Yuxarıdan fənni seç, sonra müqayisə etmək istədiyin müəllimlərə toxun — dörd meyar üzrə ballar yan-yana görünəcək.</p>
        </div>
      )}
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, CalendarCheck, Compass, MessageCircleQuestion, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type Trail = {
  joinedAt: string;
  clubs: number;
  clubNames: string[];
  eventsAttended: number;
  eventsUpcoming: number;
  reviews: number;
  questions: number;
  answers: number;
  lessons: number;
};

/**
 * "Kampus izi" — profildə real fəaliyyətin xülasəsi.
 *
 * Qəsdən xal/səviyyə sistemi DEYİL: hər rəqəm tələbənin həqiqətən etdiyi
 * bir işi göstərir. Heç bir fəaliyyət yoxdursa bölmə göstərilmir.
 */
export function CampusTrail() {
  const t = useT();
  const reduceMotion = Boolean(useReducedMotion());
  const [trail, setTrail] = useState<Trail | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/trail", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { data: null }))
      .then((payload: { data?: Trail | null }) => {
        if (!cancelled) setTrail(payload.data ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!trail) return null;

  // Cədvəl dərsləri əvvəl cəmə daxil idi, amma elementlər arasında yox idi —
  // yalnız dərsi olan istifadəçi başlıqlı, boş bölmə görürdü.
  const items = [
    { key: "clubs", icon: Compass, value: trail.clubs, label: t("trail.clubs"), hint: trail.clubNames.join(", ") },
    { key: "events", icon: CalendarCheck, value: trail.eventsAttended, label: t("trail.events"), hint: trail.eventsUpcoming ? t("trail.upcoming", { count: trail.eventsUpcoming }) : "" },
    { key: "reviews", icon: Star, value: trail.reviews, label: t("trail.reviews"), hint: "" },
    { key: "qa", icon: MessageCircleQuestion, value: trail.questions + trail.answers, label: t("trail.qa"), hint: trail.answers ? t("trail.answers", { count: trail.answers }) : "" },
    { key: "lessons", icon: BookOpen, value: trail.lessons, label: t("trail.lessons"), hint: "" },
  ].filter((item) => item.value > 0 || (item.key === "events" && trail.eventsUpcoming > 0));
  if (items.length === 0) return null;

  // Siyahı yalnız brauzerdə render olunur (fetch-dən sonra). `Intl` "az-AZ"
  // bəzi Chromium qurğularında ay adı əvəzinə "M09" verir — ad lüğətdən gəlir.
  const joined = new Date(trail.joinedAt);
  const since = Number.isNaN(joined.getTime()) ? "" : `${t(`month.${joined.getMonth() + 1}`)} ${joined.getFullYear()}`;

  return (
    <motion.section
      className="campus-trail"
      aria-labelledby="campus-trail-title"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <header>
        <h2 id="campus-trail-title"><Sparkles size={15} aria-hidden="true" /> {t("trail.title")}</h2>
        {since ? <small>{t("trail.since", { date: since })}</small> : null}
      </header>
      <div className="campus-trail__grid">
        {items.map(({ key, icon: Icon, value, label, hint }) => (
          <div key={key} className="campus-trail__item">
            <span className="campus-trail__icon" aria-hidden="true"><Icon size={16} /></span>
            <strong>{value}</strong>
            <small>{label}</small>
            {hint ? <em>{hint}</em> : null}
          </div>
        ))}
      </div>
    </motion.section>
  );
}

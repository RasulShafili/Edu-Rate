"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  GraduationCap,
  MapPin,
  Star,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { Teacher } from "../types/professionals";
import { formatDecimalScore, formatInteger } from "../lib/number-format";
import { TeacherSilhouette } from "./TeacherSilhouette";
import { useT } from "../i18n/LanguageProvider";

type TeacherProfileDrawerProps = {
  teacher: Teacher | null;
  isRatingTarget: boolean;
  selectionDisabled: boolean;
  onClose: () => void;
  onExitComplete: () => void;
  onChooseForRating: (teacher: Teacher) => void;
};

export function TeacherProfileDrawer({
  teacher,
  isRatingTarget,
  selectionDisabled,
  onClose,
  onExitComplete,
  onChooseForRating,
}: TeacherProfileDrawerProps) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const selectionRequestedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  /**
   * Portal yalnız quraşdırmadan SONRA render olunur.
   *
   * Əvvəl `typeof document === "undefined"` yoxlanışı vardı: serverdə `null`,
   * brauzerin İLK (hidrasiya) render-ində isə portal qaytarırdı. Yəni server
   * HTML-i ilə müştərinin ilk render-i fərqlənirdi və React bütün bölməni
   * atıb yenidən qururdu — konsolda "Hydration failed" xətası bundan gəlirdi.
   * `mounted` bayrağı ilk render-i hər iki tərəfdə eyni (null) saxlayır.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!teacher) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    selectionRequestedRef.current = false;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), reduceMotion ? 0 : 220);

    function onKeyDown(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        onClose();
        return;
      }
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
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (!selectionRequestedRef.current) previousFocus?.focus({ preventScroll: true });
    };
  }, [teacher, onClose, reduceMotion]);

  const drawer = (
    <AnimatePresence initial={false} onExitComplete={onExitComplete}>
      {teacher && (
        <motion.div
          className="drawer-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.28 }}
          role="presentation"
        >
          <motion.button
            type="button"
            className="drawer-backdrop"
            aria-label="Müəllim profilini bağla"
            onClick={onClose}
          />

          <motion.aside
            ref={drawerRef}
            id="teacher-profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-profile-title"
            aria-describedby="teacher-profile-description"
            className="teacher-profile-drawer"
            style={{
              "--teacher-accent": teacher.accent,
              "--teacher-glow": teacher.glow,
            } as CSSProperties}
            initial={reduceMotion ? { opacity: 0 } : { x: "105%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "105%" }}
            transition={reduceMotion
              ? { duration: 0.01 }
              : { type: "spring", stiffness: 170, damping: 25, mass: 0.78 }}
          >
            <div className="drawer-noise" aria-hidden="true" />
            <div className="drawer-topline">
              <span>Müəllim profili / {teacher.subject}</span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="drawer-close"
                aria-label="Müəllim profilini bağla"
              >
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>

            <div className="teacher-profile-hero">
              <div className="teacher-profile-visual" aria-hidden="true">
                <motion.div
                  className="teacher-profile-portrait"
                  initial={reduceMotion ? false : { scale: 1.08 }}
                  animate={{ scale: 1.02 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                >
                  <TeacherSilhouette />
                </motion.div>
                <span>{teacher.reviewCount > 0 ? <><Star size={13} fill="currentColor" /> {formatDecimalScore(teacher.rating)}</> : "Yeni profil"}</span>
              </div>

              <div className="teacher-profile-identity">
                <span>{teacher.subject}</span>
                <h2 id="teacher-profile-title">{teacher.name}</h2>
                <p>{teacher.role}</p>
              </div>
            </div>

            <p id="teacher-profile-description" className="teacher-profile-bio">{teacher.bio}</p>

            <dl className="teacher-profile-facts">
              <div>
                <dt><GraduationCap size={16} /> {t("teachers.experience")}</dt>
                <dd>{teacher.experience}</dd>
              </div>
              <div>
                <dt><MapPin size={16} /> {t("teachers.city")}</dt>
                <dd>{teacher.city}</dd>
              </div>
              <div>
                <dt><Users size={16} /> {t("teachers.community")}</dt>
                <dd>{teacher.reviewCount > 0 ? t("teachers.approvedReviews", { count: formatInteger(teacher.reviewCount) }) : t("teachers.noApprovedReviews")}</dd>
              </div>
              <div>
                <dt><CalendarClock size={16} /> {t("teachers.availability")}</dt>
                <dd>{teacher.availability}</dd>
              </div>
            </dl>

            <div className="teacher-profile-bottom">
              <div>
                <span>{t("teachers.objectiveTitle")}</span>
                <p>{t("teachers.objectiveBody")}</p>
              </div>
              <motion.button
                type="button"
                onClick={() => {
                  selectionRequestedRef.current = true;
                  onChooseForRating(teacher);
                }}
                disabled={selectionDisabled}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                {t(selectionDisabled
                  ? "teachers.reviewChecking"
                  : isRatingTarget
                    ? "teachers.goToRating"
                    : "teachers.chooseForRating")}
                <ArrowRight size={16} />
              </motion.button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // `kuds-shell` sarğısı (display:contents — heç nə çəkmir) işıqlı temanın
  // `.kuds-shell ...` seçicilərinin bədənə portal olunandan sonra da işləməsini
  // təmin edir; onsuz müəllim profili köhnə tünd temada qara qalırdı.
  if (!mounted) return null;
  return createPortal(<div className="kuds-shell" style={{ display: "contents" }}>{drawer}</div>, document.body);
}

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Scale, Send, SlidersHorizontal, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type UIEvent,
} from "react";
import type { Teacher, TeacherReview } from "../types/professionals";
import {
  areCriteriaComplete,
  calculateCriteriaAverage,
  CriteriaRating,
  defaultCriteriaRatings,
  type CriteriaRatings,
} from "./CriteriaRating";
import { ReviewCard } from "./ReviewCard";
import { TeacherCard } from "./TeacherCard";
import { TeacherProfileDrawer } from "./TeacherProfileDrawer";
import { useAuth } from "./AuthProvider";
import { formatDecimalScore, formatInteger } from "../lib/number-format";
import { getCurrentAcademicSemester } from "../lib/academic-semester";

const confettiPieces = Array.from({ length: 12 }, (_, index) => index);

type ReviewValidationResponse = {
  accepted?: boolean;
  text?: string;
  reason?: string | null;
  suggestion?: string | null;
  status?: "pending";
};

type PublishedReview = {
  id: string;
  teacherId: string;
  course: string;
  rating: number;
  author: string;
  initials: string;
  criteria: CriteriaRatings;
  createdAt: string;
};

type MySemesterReview = {
  teacherId: string;
  semester: string;
  status: "pending" | "approved" | "rejected";
};

type ProfessionalTeacher={id:string;profileId:string;available:boolean;name:string;headline:string;specialty:string;biography:string;city:string;experienceYears:number;availability:string;meetingMode:string;languages:string[];rating:number;reviewCount:number};
const teacherPalette = [
  { accent: "#44766c", glow: "rgba(68,118,108,.24)" },
  { accent: "#6f62a8", glow: "rgba(111,98,168,.22)" },
  { accent: "#b48652", glow: "rgba(180,134,82,.2)" },
] as const;
function toTeacher(profile:ProfessionalTeacher,index:number):Teacher{const color=teacherPalette[index%teacherPalette.length];return{id:profile.id,name:profile.name,initials:profile.name.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]?.toLocaleUpperCase("az")).join(""),role:profile.headline,subject:profile.specialty,bio:profile.biography,city:profile.city,experience:profile.experienceYears>0?`${profile.experienceYears} il təcrübə`:"Təcrübə məlumatı əlavə edilməyib",availability:profile.availability||"Vaxt məlumatı əlavə edilməyib",teachingMode:normalizeMode(profile.meetingMode),language:profile.languages.includes("İngilis dili")?"İngilis dili":"Azərbaycan dili",studentsCount:0,rating:profile.rating,reviewCount:profile.reviewCount,...color};}
function normalizeMode(value:string):Teacher["teachingMode"]{return value==="Onlayn"||value==="Əyani"||value==="Hibrid"?value:"Onlayn";}

async function loadPublishedReviews(): Promise<PublishedReview[]> {
  const response = await fetch("/api/reviews?limit=50", { headers: { Accept: "application/json" } });
  const payload = await response.json() as { data?: PublishedReview[]; error?: { message?: string } };
  if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Rəylər yüklənmədi.");
  return payload.data;
}

export function TeacherEvaluation() {
  const [selectedId, setSelectedId] = useState<Teacher["id"] | null>(null);
  const [profileTeacher, setProfileTeacher] = useState<Teacher | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [criteriaRatings, setCriteriaRatings] = useState<CriteriaRatings>({ ...defaultCriteriaRatings });
  const [reviewSent, setReviewSent] = useState(false);
  const [reviewChecking, setReviewChecking] = useState(false);
  const [reviewError, setReviewError] = useState<ReviewValidationResponse | null>(null);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [teacherSort, setTeacherSort] = useState("rating");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewLimit, setReviewLimit] = useState(6);
  const [availableTeacherIds,setAvailableTeacherIds]=useState<Set<string>|null>(null);
  const [teacherCatalogError,setTeacherCatalogError]=useState("");
  const [catalogTeachers,setCatalogTeachers]=useState<Teacher[]>([]);
  const [semesterReviews, setSemesterReviews] = useState<Record<string, MySemesterReview>>({});
  const [semesterReviewsOwnerId, setSemesterReviewsOwnerId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const ratingPanelRef = useRef<HTMLDivElement>(null);
  const confirmationTimer = useRef<number | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const ratingScrollFrame = useRef<number | null>(null);
  const ratingScrollPending = useRef(false);
  const reduceMotion = useReducedMotion();
  const { user } = useAuth();
  const currentSemester = useMemo(() => getCurrentAcademicSemester(), []);
  const semesterReviewsLoading = Boolean(user && semesterReviewsOwnerId !== user.id);
  const publishedReviews = useSWR("published-teacher-reviews", loadPublishedReviews, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const teachers = catalogTeachers;
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const controller = new AbortController();
    void fetch(`/api/reviews/mine?semester=${encodeURIComponent(currentSemester)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { data?: MySemesterReview[] };
        if (!response.ok || !payload.data) throw new Error("Review history unavailable");
        if (!cancelled) {
          setSemesterReviews(Object.fromEntries(payload.data.map((review) => [review.teacherId, review])));
          setSemesterReviewsOwnerId(user.id);
        }
      })
      .catch((cause) => {
        if (!cancelled && cause instanceof Error && cause.name !== "AbortError") {
          setSemesterReviews({});
          setSemesterReviewsOwnerId(user.id);
        }
      })
    return () => { cancelled = true; controller.abort(); };
  }, [currentSemester, user]);
  useEffect(()=>{let cancelled=false;void fetch("/api/catalog/teachers",{cache:"no-store"}).then(async(response)=>{const payload=await response.json() as {data?:ProfessionalTeacher[];error?:{message?:string}};if(!response.ok)throw new Error(payload.error?.message??"Müəllim kataloqu yüklənmədi.");if(!cancelled){const active=(payload.data??[]).filter((item)=>item.available);setAvailableTeacherIds(new Set(active.map((item)=>item.id)));setCatalogTeachers(active.map(toTeacher));}}).catch((value)=>{if(!cancelled){setAvailableTeacherIds(new Set());setTeacherCatalogError(value instanceof Error?value.message:"Müəllim kataloqu yüklənmədi.");}});return()=>{cancelled=true;};},[]);
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedId) ?? null;
  const selectedSemesterReview = selectedTeacher && semesterReviewsOwnerId === user?.id
    ? semesterReviews[selectedTeacher.id]
    : undefined;
  const liveReviews = useMemo<TeacherReview[]>(() => (publishedReviews.data ?? []).map((review) => {
    const teacher = teachers.find((item) => item.id === review.teacherId);
    return {
      id: review.id,
      teacherId: review.teacherId,
      teacherName: teacher?.name ?? "Müəllim",
      author: review.author,
      initials: review.initials,
      rating: review.rating,
      date: new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(review.createdAt)),
      course: review.course,
      accent: teacher?.accent ?? "#44766c",
      criteria: review.criteria,
    };
  }), [publishedReviews.data, teachers]);
  const allReviews = liveReviews;
  const displayedTeachers = useMemo(() => {
    const query = teacherQuery.trim().toLocaleLowerCase("az");
    const filtered = teachers.filter((teacher) => {
      if(!availableTeacherIds?.has(teacher.id)) return false;
      const matchesQuery = !query || `${teacher.name} ${teacher.subject}`.toLocaleLowerCase("az").includes(query);
      const matchesSubject = subjectFilter === "all" || teacher.subject === subjectFilter;
      const matchesMode = modeFilter === "all" || teacher.teachingMode === modeFilter;
      const matchesLanguage = languageFilter === "all" || teacher.language === languageFilter;
      return matchesQuery && matchesSubject && matchesMode && matchesLanguage;
    });
    return [...filtered].sort((left, right) => teacherSort === "reviews" ? right.reviewCount - left.reviewCount : right.rating - left.rating);
  }, [availableTeacherIds, languageFilter, modeFilter, subjectFilter, teacherQuery, teacherSort, teachers]);
  const rating = calculateCriteriaAverage(criteriaRatings);
  /**
   * Qiymətləndirməni yalnız tələbə hesabı göndərə bilər (`reviews.ts:68`).
   * Əvvəl interfeys bunu nəzərə almırdı: müəllim və ya admin bütün formanı
   * görür, dörd meyarı doldurur, "göndər" basır və yalnız onda 403 alırdı.
   */
  const canReview = user?.accessRole === "student";
  const canSubmit = Boolean(selectedTeacher)
    && canReview
    && areCriteriaComplete(criteriaRatings)
    && !selectedSemesterReview
    && !semesterReviewsLoading
    && !reviewSent
    && !reviewChecking;

  useEffect(() => () => {
    if (confirmationTimer.current) window.clearTimeout(confirmationTimer.current);
    if (scrollFrame.current) window.cancelAnimationFrame(scrollFrame.current);
    if (ratingScrollFrame.current) window.cancelAnimationFrame(ratingScrollFrame.current);
  }, []);

  const openTeacherProfile = useCallback((teacher: Teacher) => {
    setProfileTeacher(teacher);
  }, []);

  const closeTeacherProfile = useCallback(() => {
    setProfileTeacher(null);
  }, []);

  const scrollToSelectedTeacherRating = useCallback(() => {
    if (!ratingScrollPending.current) return;
    ratingScrollPending.current = false;
    if (ratingScrollFrame.current) window.cancelAnimationFrame(ratingScrollFrame.current);
    ratingScrollFrame.current = window.requestAnimationFrame(() => {
      ratingScrollFrame.current = null;
      ratingPanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      ratingPanelRef.current?.focus({ preventScroll: true });
    });
  }, [reduceMotion]);

  function selectTeacher(teacher: Teacher) {
    if (reviewChecking) return;
    const alreadySelected = selectedId === teacher.id;
    if (!alreadySelected) {
      if (confirmationTimer.current) {
        window.clearTimeout(confirmationTimer.current);
        confirmationTimer.current = null;
      }
      setSelectedId(teacher.id);
      setCriteriaRatings({ ...defaultCriteriaRatings });
      setReviewSent(false);
      setReviewError(null);
    }
    ratingScrollPending.current = true;
    closeTeacherProfile();
  }

  function moveCarousel(direction: -1 | 1) {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(".teacher-card");
    if (!track || !card) return;
    const gap = 14;
    track.scrollBy({ left: direction * (card.offsetWidth + gap), behavior: reduceMotion ? "auto" : "smooth" });
  }

  function updateActiveCard(event: UIEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    if (scrollFrame.current) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      const card = track.querySelector<HTMLElement>(".teacher-card");
      scrollFrame.current = null;
      if (!card) return;
      const next = Math.min(displayedTeachers.length - 1, Math.max(0, Math.round(track.scrollLeft / (card.offsetWidth + 14))));
      setActiveIndex((current) => current === next ? current : next);
    });
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !selectedTeacher) return;

    setReviewChecking(true);
    setReviewError(null);

    let validation: ReviewValidationResponse;
    try {
      const response = await fetch("/api/reviews/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: criteriaRatings,
          teacherId: selectedTeacher.id,
          course: selectedTeacher.subject,
          semester: currentSemester,
        }),
      });
      validation = await response.json() as ReviewValidationResponse;
      if (!response.ok || !validation.accepted) {
        setReviewError({
          reason: validation.reason ?? "Rəy bu formada qəbul edilmədi.",
          suggestion: validation.suggestion ?? "Mətni tədris təcrübəsinə yönəldərək yenidən yoxla.",
        });
        return;
      }
    } catch {
      setReviewError({
        reason: "Rəyi indi yoxlaya bilmədik.",
        suggestion: "Mətnin saxlanılıb. Bağlantını yoxlayıb bir daha göndər.",
      });
      return;
    } finally {
      setReviewChecking(false);
    }

    setSemesterReviews((reviews) => ({
      ...reviews,
      [selectedTeacher.id]: {
        teacherId: selectedTeacher.id,
        semester: currentSemester,
        status: validation.status ?? "pending",
      },
    }));
    setReviewSent(true);

    if (confirmationTimer.current) window.clearTimeout(confirmationTimer.current);
    confirmationTimer.current = window.setTimeout(() => {
      setReviewSent(false);
      setCriteriaRatings({ ...defaultCriteriaRatings });
    }, reduceMotion ? 900 : 2400);
  }

  return (
    <section id="teachers" className="teachers-section route-module-section" aria-labelledby="teachers-title">
      <div className="teachers-grid-texture" aria-hidden="true" />
      <motion.div
        className="teachers-heading"
        initial={reduceMotion ? false : { opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <span className="teachers-kicker">Müəllim seçimi</span>
          <h1 id="teachers-title" className="module-page-title">Müəllimlər</h1>
          <Link href="/teachers/compare" className="teachers-compare-link">
            <Scale size={15} /> Hansı müəllimi seçim? Yan-yana müqayisə et
          </Link>
        </div>
        <div className="teachers-heading-aside">
          <div className="teacher-carousel-controls">
            <button type="button" onClick={() => moveCarousel(-1)} aria-label="Əvvəlki müəllim" aria-controls="available-teachers-track">
              <ArrowLeft size={17} />
            </button>
            <span><strong>{String(activeIndex + 1).padStart(2, "0")}</strong> / {String(teachers.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => moveCarousel(1)} aria-label="Növbəti müəllim" aria-controls="available-teachers-track">
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </motion.div>

      <button
        type="button"
        className="directory-filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="teacher-directory-filters"
        onClick={() => setFiltersOpen((current) => !current)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Filtrlər</span>
        <small>{displayedTeachers.length} nəticə</small>
      </button>
      <div
        id="teacher-directory-filters"
        className={`teacher-directory-filters${filtersOpen ? " is-open" : ""}`}
        aria-label="Müəllim axtarış filtrləri"
      >
        <label>
          <span>Müəllim və ya fənn</span>
          <input type="search" value={teacherQuery} onChange={(event) => setTeacherQuery(event.target.value)} placeholder="Məsələn, riyaziyyat" />
        </label>
        <label>
          <span>Tədris dili</span>
          <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
            <option value="all">Bütün dillər</option>
            <option value="Azərbaycan dili">Azərbaycan dili</option>
            <option value="İngilis dili">İngilis dili</option>
          </select>
        </label>
        <label>
          <span>Sıralama</span>
          <select value={teacherSort} onChange={(event) => setTeacherSort(event.target.value)}>
            <option value="rating">Ən yüksək reytinq</option>
            <option value="reviews">Ən çox rəy</option>
          </select>
        </label>
        <label>
          <span>Fənn</span>
          <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="all">Bütün fənlər</option>
            {[...new Set(teachers.map((teacher) => teacher.subject))].map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </select>
        </label>
        <label>
          <span>Tədris formatı</span>
          <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
            <option value="all">Bütün formatlar</option>
            <option value="Onlayn">Onlayn</option>
            <option value="Əyani">Əyani</option>
            <option value="Hibrid">Hibrid</option>
          </select>
        </label>
      </div>

      <div
        id="available-teachers-track"
        ref={trackRef}
        className="teachers-track"
        role="list"
        aria-label="Hazırda müsait müəllimlər"
        onScroll={updateActiveCard}
      >
        {displayedTeachers.map((teacher, index) => (
          <TeacherCard
            key={teacher.id}
            teacher={teacher}
            index={index}
            isRatingTarget={selectedId === teacher.id}
            isProfileOpen={profileTeacher?.id === teacher.id}
            disabled={reviewChecking}
            scrollContainer={trackRef}
            onOpenProfile={openTeacherProfile}
          />
        ))}
        {displayedTeachers.length === 0 && <div className="teacher-filter-empty">{availableTeacherIds===null?"Müəllimlər yüklənir…":teacherCatalogError||"Bu filtrlərə uyğun müəllim tapılmadı."}</div>}
        <span className="teachers-track-spacer" aria-hidden="true" />
      </div>

      <TeacherProfileDrawer
        teacher={profileTeacher}
        isRatingTarget={profileTeacher?.id === selectedId}
        selectionDisabled={reviewChecking}
        onClose={closeTeacherProfile}
        onExitComplete={scrollToSelectedTeacherRating}
        onChooseForRating={selectTeacher}
      />

      <AnimatePresence mode="wait" initial={false}>
        {selectedTeacher ? (
        <motion.div
          ref={ratingPanelRef}
          key={selectedTeacher.id}
          id="teacher-rating-panel"
          className="teacher-rating-panel"
          tabIndex={-1}
          role="region"
          aria-labelledby="teacher-rating-title"
          style={{ "--selected-accent": selectedTeacher.accent } as CSSProperties}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.992 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.994 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rating-panel-copy">
            <span><Sparkles size={13} /> Təcrübəni qiymətləndir</span>
            <h3 id="teacher-rating-title">{selectedTeacher.name} sənə necə kömək etdi?</h3>
            <p>Dörd peşəkar meyar üzrə verdiyin rəqəmsal qiymət digər tələbələrin daha doğru seçim etməsinə kömək edir.</p>
            <div className="rating-teacher-chip">
              <i>{selectedTeacher.initials}</i>
              <span><strong>{selectedTeacher.subject}</strong><small>{formatInteger(selectedTeacher.reviewCount)} təsdiqlənmiş qiymətləndirmə</small></span>
            </div>
          </div>

          {!user ? (
            <div className="rating-auth-required">
              <span>Rəylərin etibarlılığını qoruyuruq</span>
              <h3>Qiymətləndirmək üçün hesabına daxil ol.</h3>
              <p>Hər tələbə eyni müəllim üçün semestr ərzində yalnız bir qiymətləndirmə göndərə bilər.</p>
              <Link href="/auth?returnTo=%2Fteachers">Daxil ol <ArrowRight size={15} /></Link>
            </div>
          ) : !canReview ? (
            <div className="rating-auth-required">
              <span>Qiymətləndirmə tələbə hesabları üçündür</span>
              <h3>Bu hesabla qiymətləndirmə göndərilə bilməz.</h3>
              <p>Müəllim qiymətləndirməsini yalnız tələbə hesabı göndərir. Profilləri nəzərdən keçirə və dərc olunmuş nəticələri izləyə bilərsən.</p>
            </div>
          ) : selectedSemesterReview && !reviewSent ? (
            <div className="teacher-review-existing" role="status">
              <i><Check size={22} aria-hidden="true" /></i>
              <span>Cari semestr qiymətləndirməsi</span>
              <h3>Sən bu müəllimə cari semestr üçün artıq rəy vermisən.</h3>
              <p>
                {selectedSemesterReview.status === "approved"
                  ? "Qiymətləndirmən təsdiqlənib və müəllimin göstəricilərinə əlavə olunub."
                  : selectedSemesterReview.status === "rejected"
                    ? "Qiymətləndirmən moderasiya qaydalarına uyğun olmadığı üçün qəbul edilməyib."
                    : "Qiymətləndirmən yoxlanılır. Nəticə təsdiqdən sonra ümumi göstəricilərə əlavə olunacaq."}
              </p>
            </div>
          ) : <form className="rating-form" onSubmit={submitReview}>
            <CriteriaRating
              value={criteriaRatings}
              onChange={(nextRatings) => {
                setCriteriaRatings(nextRatings);
                setReviewError(null);
              }}
              teacherName={selectedTeacher.name}
              disabled={reviewChecking || reviewSent}
              className="criteria-rating"
            />
            <p className="review-score-explanation">Açıq mətn rəyi qəbul edilmir. Ümumi bal izahın aydınlığı, fənn biliyi, obyektivlik və ünsiyyət ballarının bərabər çəkili ortasıdır.</p>
            <AnimatePresence initial={false}>
              {reviewError && (
                <motion.div
                  id="teacher-review-error"
                  className="review-moderation-message"
                  role="alert"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.99 }}
                >
                  <CircleAlert size={16} />
                  <p><strong>{reviewError.reason}</strong><span>{reviewError.suggestion}</span></p>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rating-form-footer">
              <small>
                {areCriteriaComplete(criteriaRatings)
                  ? `Orta qiymət: ${formatDecimalScore(rating)} / 5`
                  : "Dörd meyarı tamamla"}
              </small>
              <motion.button type="submit" disabled={!canSubmit} whileTap={reduceMotion ? undefined : { scale: 0.96 }}>
                {reviewSent ? <Check size={15} /> : reviewChecking ? <i className="review-check-spinner" /> : <Send size={14} />}
                {reviewSent ? "Qiymət göndərildi" : reviewChecking ? "Qiymət saxlanılır" : "Qiyməti göndər"}
              </motion.button>
            </div>

            <AnimatePresence>
              {reviewSent && (
                <motion.div
                  className="review-confirmation"
                  role="status"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 280, damping: 19 }}
                >
                  <motion.i
                    initial={reduceMotion ? false : { scale: 0, rotate: -18 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 360, damping: 18, delay: 0.08 }}
                  >
                    <Check size={25} />
                  </motion.i>
                  <strong>Qiymətləndirmən göndərildi</strong>
                  <span>Təşəkkür edirik — rəqəmsal nəticə təsdiqləndikdən sonra müəllimin ümumi göstəricilərinə əlavə olunacaq.</span>
                  {!reduceMotion && (
                    <b className="review-success-ring" aria-hidden="true" />
                  )}
                  {!reduceMotion && (
                    <div className="review-confetti" aria-hidden="true">
                      {confettiPieces.map((piece) => <i key={piece} style={{ "--piece": piece } as CSSProperties} />)}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </form>}
        </motion.div>
      ) : (
        <motion.div
          key="rating-empty"
          className="teacher-rating-empty"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <span>Hələ müəllim seçilməyib</span>
            <h2>Əvvəl profillə tanış ol.</h2>
            <p>Müəllim kartına toxun, profili nəzərdən keçir və sonra qiymətləndirmək üçün seç.</p>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      <div className="reviews-heading">
        <div>
          <span className="teachers-kicker">Tələbə qiymətləndirmələri</span>
          <h2>Son nəticələr</h2>
        </div>
        <p><Star size={14} fill="currentColor" /> {formatInteger(allReviews.length)} dərc edilmiş qiymətləndirmə</p>
      </div>

      <div className="reviews-masonry" aria-label="Müəllimlərin rəqəmsal qiymətləndirmələri">
        {allReviews.slice(0, reviewLimit).map((review, index) => <ReviewCard key={review.id} review={review} index={index} />)}
      </div>
      {reviewLimit < allReviews.length && (
        <button type="button" className="reviews-load-more" onClick={() => setReviewLimit((current) => current + 6)}>
          Daha çox nəticə göstər
        </button>
      )}
    </section>
  );
}

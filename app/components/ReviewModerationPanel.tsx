"use client";

import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { useT } from "../i18n/LanguageProvider";
import { adminErrorKey } from "../lib/admin-errors";
import { ApiError, createApiClient } from "../lib/api/client";

type ModerationReview = {
  id: string;
  teacherId: string;
  course: string;
  semester: string;
  rating: number;
  criteria: { clarity: number; subjectKnowledge: number; objectivity: number; communication: number };
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type CatalogTeacher = { slug?: string; id?: string; profileId?: string; name: string };

const api = createApiClient({ baseUrl: "/api" });
const criteria = ["clarity", "subjectKnowledge", "objectivity", "communication"] as const;

export function ReviewModerationPanel() {
  const t = useT();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const loader = useCallback(() => api.get<ModerationReview[]>("/admin/reviews?status=pending"), []);
  const { data, error, isLoading, isValidating, mutate } = useSWR("admin-pending-reviews", loader, {
    revalidateOnFocus: false,
  });
  // Rəy müəllimi slug ilə saxlayır; admin əvvəl yalnız bu xam identifikatoru
  // görürdü və kimin qiymətləndirildiyini bilmədən qərar verirdi.
  const teachersLoader = useCallback(() => api.get<CatalogTeacher[]>("/catalog/teachers"), []);
  const { data: teachers } = useSWR("admin-review-teachers", teachersLoader, { revalidateOnFocus: false });
  const teacherName = (teacherId: string) =>
    teachers?.find((teacher) => [teacher.slug, teacher.id, teacher.profileId].includes(teacherId))?.name ?? teacherId;

  async function decide(id: string, status: "approved" | "rejected") {
    setActionId(id);
    setActionError("");
    try {
      await api.patch<ModerationReview, { status: typeof status }>(`/admin/reviews/${encodeURIComponent(id)}`, { status });
      await mutate((current) => current?.filter((review) => review.id !== id), { revalidate: false });
    } catch (decisionError) {
      // Əvvəl burada `catch` yox idi: uğursuz qərar səssiz qalırdı, rəy siyahıda
      // dururdu və admin qərarın saxlanıb-saxlanmadığını bilmirdi.
      if (decisionError instanceof ApiError && decisionError.status === 404) {
        setActionError("admin.decision.alreadyDecided");
        await mutate();
      } else {
        setActionError(adminErrorKey(decisionError, "admin.decision.failed"));
      }
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="admin-review-panel" aria-labelledby="admin-reviews-title" aria-busy={isLoading || isValidating}>
      <header>
        <div>
          <span><ShieldCheck size={14} aria-hidden="true" /> {t("admin.reviews.eyebrow")}</span>
          <h2 id="admin-reviews-title">{t("admin.reviews.title")}</h2>
        </div>
        <button type="button" onClick={() => void mutate()} disabled={isValidating} aria-label={t("admin.reviews.refresh")}>
          <RefreshCw size={15} aria-hidden="true" /> {t("admin.refresh")}
        </button>
      </header>

      <div aria-live="polite">
        {actionError ? <p className="admin-operations__error" role="alert">{t(actionError)}</p> : null}
      </div>

      {isLoading ? (
        <div className="admin-review-skeleton" aria-label={t("admin.reviews.loading")}><i /><i /><i /></div>
      ) : error ? (
        <div className="admin-review-state" role="alert"><strong>{t("admin.reviews.error")}</strong><button type="button" onClick={() => void mutate()}>{t("common.retry")}</button></div>
      ) : !data?.length ? (
        <div className="admin-review-state"><strong>{t("admin.reviews.empty")}</strong><p>{t("admin.reviews.emptyHint")}</p></div>
      ) : (
        <div className="admin-review-list">
          {data.map((review) => (
            <article key={review.id}>
              <div><span>{review.course} · {review.semester}</span><strong>{review.rating.toFixed(1)} / 5</strong></div>
              <div className="admin-review-criteria">
                {criteria.map((criterion) => (
                  <span key={criterion}>{t(`rating.${criterion}`)} <b>{review.criteria[criterion]}/5</b></span>
                ))}
              </div>
              <footer>
                <small>{teacherName(review.teacherId)}</small>
                <div>
                  <button type="button" onClick={() => void decide(review.id, "rejected")} disabled={actionId === review.id}><X size={14} aria-hidden="true" /> {t("admin.ops.reject")}</button>
                  <button type="button" onClick={() => void decide(review.id, "approved")} disabled={actionId === review.id}><Check size={14} aria-hidden="true" /> {t("admin.ops.approve")}</button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

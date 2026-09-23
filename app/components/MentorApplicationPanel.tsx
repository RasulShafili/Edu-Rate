"use client";

import { Check, HeartHandshake, RefreshCw, X } from "lucide-react";
import { useCallback, useState } from "react";
import useSWR from "swr";
import { useT } from "../i18n/LanguageProvider";
import { adminErrorKey } from "../lib/admin-errors";
import { ApiError, createApiClient } from "../lib/api/client";

type MentorApplication = {
  id: string;
  teacherName: string;
  specialty: string;
  biography: string;
  availability: string;
  meetingMode: string;
  languages: string[];
  status: "pending" | "approved" | "rejected";
};

const api = createApiClient({ baseUrl: "/api" });
const MODE_KEYS: Record<string, string> = { Onlayn: "mentors.mode.online", "Əyani": "mentors.mode.inPerson", Hibrid: "mentors.mode.hybrid" };

export function MentorApplicationPanel() {
  const t = useT();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const loader = useCallback(() => api.get<MentorApplication[]>("/admin/mentor-applications?status=pending"), []);
  const { data, error, isLoading, isValidating, mutate } = useSWR("admin-mentor-applications", loader, { revalidateOnFocus: false });

  async function decide(id: string, status: "approved" | "rejected") {
    setActionId(id);
    setActionError("");
    try {
      await api.patch(`/admin/mentor-applications/${encodeURIComponent(id)}`, { status });
      await mutate((current) => current?.filter((item) => item.id !== id), { revalidate: false });
    } catch (decisionError) {
      // Əvvəl burada `catch` yox idi: xəta səssizcə udulurdu, müraciət siyahıda
      // qalırdı və admin qərarın saxlanıb-saxlanmadığını bilmirdi.
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
    <section className="admin-review-panel" aria-labelledby="admin-mentor-applications-title" aria-busy={isLoading || isValidating}>
      <header>
        <div>
          <span><HeartHandshake size={14} aria-hidden="true" /> {t("admin.mentorApps.eyebrow")}</span>
          <h2 id="admin-mentor-applications-title">{t("admin.mentorApps.title")}</h2>
        </div>
        <button type="button" onClick={() => void mutate()} disabled={isValidating} aria-label={t("admin.mentorApps.refresh")}>
          <RefreshCw size={15} aria-hidden="true" /> {t("admin.refresh")}
        </button>
      </header>

      <div aria-live="polite">
        {actionError ? <p className="admin-operations__error" role="alert">{t(actionError)}</p> : null}
      </div>

      {isLoading ? (
        <div className="admin-review-skeleton" aria-label={t("admin.mentorApps.loading")}><i /><i /><i /></div>
      ) : error ? (
        <div className="admin-review-state" role="alert"><strong>{t("admin.mentorApps.error")}</strong><button type="button" onClick={() => void mutate()}>{t("common.retry")}</button></div>
      ) : !data?.length ? (
        <div className="admin-review-state"><strong>{t("admin.mentorApps.empty")}</strong><p>{t("admin.mentorApps.emptyHint")}</p></div>
      ) : (
        <div className="admin-review-list">
          {data.map((application) => (
            <article key={application.id}>
              <div><span>{application.teacherName}</span><strong>{MODE_KEYS[application.meetingMode] ? t(MODE_KEYS[application.meetingMode]) : application.meetingMode}</strong></div>
              <h3>{application.specialty}</h3>
              <p>{application.biography}</p>
              <footer>
                <small>{application.availability} · {application.languages.join(", ")}</small>
                <div>
                  <button type="button" onClick={() => void decide(application.id, "rejected")} disabled={actionId === application.id}><X size={14} aria-hidden="true" /> {t("admin.ops.reject")}</button>
                  <button type="button" onClick={() => void decide(application.id, "approved")} disabled={actionId === application.id}><Check size={14} aria-hidden="true" /> {t("admin.ops.approve")}</button>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

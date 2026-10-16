"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, useCallback, useState, useEffect } from "react";
import { GraduationCap, HeartHandshake } from "lucide-react";
import { TeacherEvaluation } from "./TeacherEvaluation";
import { MentorshipDashboard } from "./MentorshipDashboard";
import { useLanguage } from "../i18n/LanguageProvider";

type Tab = "teachers" | "mentors";

function TeachersAndMentorsContent({ initialTab = "teachers" }: { initialTab?: Tab }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  const queryTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    queryTab === "mentors" || initialTab === "mentors" ? "mentors" : "teachers"
  );

  useEffect(() => {
    if (queryTab === "mentors" || queryTab === "teachers") {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "mentors") {
        params.set("tab", "mentors");
      } else {
        params.delete("tab");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="teachers-mentors-unified">
      {/* Top Segmented Controls */}
      <div className="teachers-mentors-nav-wrap">
        <div className="teachers-mentors-tabs" role="tablist" aria-label="Müəllim və Mentor seçimi">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "teachers"}
            className={`teachers-mentors-tab-btn ${activeTab === "teachers" ? "is-active" : ""}`}
            onClick={() => handleTabChange("teachers")}
          >
            <GraduationCap size={18} aria-hidden="true" />
            <span>{t("nav.teachers") || "Müəllimlər"}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "mentors"}
            className={`teachers-mentors-tab-btn ${activeTab === "mentors" ? "is-active" : ""}`}
            onClick={() => handleTabChange("mentors")}
          >
            <HeartHandshake size={18} aria-hidden="true" />
            <span>{t("nav.mentors") || "Mentorlar"}</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="teachers-mentors-content">
        {activeTab === "teachers" ? (
          <div role="tabpanel" aria-label="Müəllimlər">
            <TeacherEvaluation />
          </div>
        ) : (
          <div role="tabpanel" aria-label="Mentorlar">
            <MentorshipDashboard />
          </div>
        )}
      </div>
    </div>
  );
}

export function TeachersAndMentorsExperience({ initialTab = "teachers" }: { initialTab?: Tab }) {
  return (
    <Suspense fallback={<div className="p-6 text-center text-sm text-muted">Yüklənir...</div>}>
      <TeachersAndMentorsContent initialTab={initialTab} />
    </Suspense>
  );
}

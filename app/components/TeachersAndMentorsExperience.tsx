"use client";

import { TeacherEvaluation } from "./TeacherEvaluation";

type Tab = "teachers" | "mentors";

export function TeachersAndMentorsExperience(_props: { initialTab?: Tab } = {}) {
  return (
    <div className="teachers-mentors-unified">
      <div className="teachers-mentors-content">
        <TeacherEvaluation />
      </div>
    </div>
  );
}

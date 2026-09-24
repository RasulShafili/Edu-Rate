import type { Metadata } from "next";
import { pageMetadata } from "../../i18n/server";
import { TeacherCompare } from "../../components/TeacherCompare";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("teachersCompare", { alternates: { canonical: "/teachers/compare" } });
}

export default function TeacherComparePage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <TeacherCompare />
    </main>
  );
}

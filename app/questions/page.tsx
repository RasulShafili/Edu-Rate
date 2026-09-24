import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { QuestionsExperience } from "../components/QuestionsExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("questions", { alternates: { canonical: "/questions" } });
}

export default function QuestionsPage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <QuestionsExperience />
    </main>
  );
}

import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { TeachersAndMentorsExperience } from "../components/TeachersAndMentorsExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("mentors", { alternates: { canonical: "/mentors" } });
}

export default function MentorsPage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <TeachersAndMentorsExperience initialTab="mentors" />
    </main>
  );
}

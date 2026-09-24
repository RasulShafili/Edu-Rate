import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { ScheduleExperience } from "../components/ScheduleExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("schedule", { alternates: { canonical: "/schedule" } });
}

export default function SchedulePage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <ScheduleExperience />
    </main>
  );
}

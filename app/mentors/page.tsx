import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { MentorshipDashboard } from "../components/MentorshipDashboard";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("mentors", { alternates: { canonical: "/mentors" } });
}

export default function MentorsPage() {
  return <main id="main-content" className="route-page" tabIndex={-1}><MentorshipDashboard /></main>;
}

import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { EventsExperience } from "../components/EventsExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("events", { alternates: { canonical: "/events" } });
}

export default function EventsPage() {
  return <main id="main-content" className="route-page" tabIndex={-1}><EventsExperience /></main>;
}

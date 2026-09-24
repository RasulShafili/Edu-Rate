import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { ConnectionsExperience } from "../components/ConnectionsExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("community", { alternates: { canonical: "/community" } });
}

export default function CommunityPage() {
  return <main id="main-content" className="route-page" tabIndex={-1}><ConnectionsExperience /></main>;
}

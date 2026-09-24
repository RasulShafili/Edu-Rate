import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { StudentFeedRemote } from "../components/StudentFeedRemote";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("feed", { alternates: { canonical: "/feed" } });
}

export default function FeedPage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <StudentFeedRemote />
    </main>
  );
}

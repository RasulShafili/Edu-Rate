import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { WelcomeExperience } from "../components/WelcomeExperience";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("welcome", { alternates: { canonical: "/welcome" } });
}

export default function WelcomePage() {
  return (
    <main id="main-content" className="route-page" tabIndex={-1}>
      <WelcomeExperience />
    </main>
  );
}

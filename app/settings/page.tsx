import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { redirect } from "next/navigation";
import { SettingsExperience } from "../components/SettingsExperience";
import { SessionWaking } from "../components/SessionWaking";
import { resolveServerIdentity } from "../lib/auth/request-identity";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("settings", { robots: { index: false, follow: false } });
}

export default async function SettingsPage() {
  const identity = await resolveServerIdentity();
  if (identity === "unavailable") return <main id="main-content" className="route-page" tabIndex={-1}><SessionWaking /></main>;
  if (!identity) redirect("/auth?returnTo=%2Fsettings");
  return <main id="main-content" className="route-page" tabIndex={-1}><SettingsExperience /></main>;
}

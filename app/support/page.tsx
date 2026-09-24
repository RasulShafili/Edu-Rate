import type { Metadata } from "next";
import { pageMetadata } from "../i18n/server";
import { SupportCenter } from "../components/SupportCenter";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("support", { alternates: { canonical: "/support" } });
}

export default function SupportPage() {
  return <main id="main-content" className="route-page" tabIndex={-1}><SupportCenter /></main>;
}

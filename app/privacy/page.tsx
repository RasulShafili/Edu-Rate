import type { Metadata } from "next";
import { LegalDocument } from "../components/LegalDocument";
import { pageMetadata } from "../i18n/server";
import { privacyPolicy } from "../legal/privacy";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", { alternates: { canonical: "/privacy" } });
}

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" docs={privacyPolicy} />;
}

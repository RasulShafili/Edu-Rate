import type { Metadata } from "next";
import { LegalDocument } from "../components/LegalDocument";
import { pageMetadata } from "../i18n/server";
import { communityGuidelines } from "../legal/guidelines";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("guidelines", { alternates: { canonical: "/community-guidelines" } });
}

export default function CommunityGuidelinesPage() {
  return <LegalDocument kind="guidelines" docs={communityGuidelines} />;
}

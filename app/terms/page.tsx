import type { Metadata } from "next";
import { LegalDocument } from "../components/LegalDocument";
import { pageMetadata } from "../i18n/server";
import { termsOfUse } from "../legal/terms";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("terms", { alternates: { canonical: "/terms" } });
}

export default function TermsPage() {
  return <LegalDocument kind="terms" docs={termsOfUse} />;
}

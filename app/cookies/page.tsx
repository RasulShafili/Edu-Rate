import type { Metadata } from "next";
import { LegalDocument } from "../components/LegalDocument";
import { pageMetadata } from "../i18n/server";
import { cookiePolicy } from "../legal/cookies";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("cookies", { alternates: { canonical: "/cookies" } });
}

export default function CookiesPage() {
  return <LegalDocument kind="cookies" docs={cookiePolicy} />;
}

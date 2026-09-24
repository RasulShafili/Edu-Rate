import type { Metadata } from "next";
import { Fragment } from "react";
import { getServerT, pageMetadata } from "../i18n/server";
import { PageHeader } from "../components/ui/Primitives";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("terms", { alternates: { canonical: "/terms" } });
}

// Mətn əvvəl yalnız azərbaycanca yazılmışdı; indi seçilmiş dildə serverdə qurulur.
const sections = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default async function TermsPage() {
  const t = await getServerT();
  return (
    <main id="main-content" className="route-page legal-page" tabIndex={-1}>
      <PageHeader
        id="terms-title"
        eyebrow={t("legal.eyebrow").replace("{date}", `15 ${t("month.8")} 2026`)}
        title={t("legal.terms.title")}
        description={t("legal.terms.lead")}
      />
      <article>
        {sections.map((section) => (
          <Fragment key={section}>
            <h2>{t(`legal.terms.${section}.title`)}</h2>
            <p>{t(`legal.terms.${section}.body`)}</p>
          </Fragment>
        ))}
      </article>
    </main>
  );
}

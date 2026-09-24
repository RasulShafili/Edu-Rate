import type { Metadata } from "next";
import { Fragment } from "react";
import { getServerT, pageMetadata } from "../i18n/server";
import { PageHeader } from "../components/ui/Primitives";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", { alternates: { canonical: "/privacy" } });
}

// Mətn əvvəl yalnız azərbaycanca yazılmışdı; indi seçilmiş dildə serverdə qurulur.
const sections = ["s1", "s2", "s3", "s4"] as const;

export default async function PrivacyPage() {
  const t = await getServerT();
  return (
    <main id="main-content" className="route-page legal-page" tabIndex={-1}>
      <PageHeader
        id="privacy-title"
        eyebrow={t("legal.eyebrow").replace("{date}", `15 ${t("month.8")} 2026`)}
        title={t("legal.privacy.title")}
        description={t("legal.privacy.lead")}
      />
      <article>
        {sections.map((section) => (
          <Fragment key={section}>
            <h2>{t(`legal.privacy.${section}.title`)}</h2>
            <p>{t(`legal.privacy.${section}.body`)}</p>
          </Fragment>
        ))}
        <h2>{t("legal.privacy.s5.title")}</h2>
        <p>
          {t("legal.privacy.s5.before")}
          <a href="/support?topic=privacy">{t("legal.privacy.s5.link")}</a>
          {t("legal.privacy.s5.after")}
        </p>
      </article>
    </main>
  );
}

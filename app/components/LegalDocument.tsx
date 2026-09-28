import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { getServerLanguage, getServerT } from "../i18n/server";
import type { LegalBlock, LegalDocSet } from "../legal/types";
import { LEGAL_CONTACT_EMAIL, LEGAL_VERSION } from "../legal/version";
import { PageHeader } from "./ui/Primitives";

type LegalKind = "privacy" | "terms" | "cookies" | "guidelines";

const NAV: { kind: LegalKind; href: string; key: string }[] = [
  { kind: "privacy", href: "/privacy", key: "legalNav.privacy" },
  { kind: "terms", href: "/terms", key: "legalNav.terms" },
  { kind: "cookies", href: "/cookies", key: "legalNav.cookies" },
  { kind: "guidelines", href: "/community-guidelines", key: "legalNav.guidelines" },
];

/** E-poçt ünvanını mətndə klikləmə linkinə çevirir. */
function withLinks(text: string): ReactNode {
  const parts = text.split(LEGAL_CONTACT_EMAIL);
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 ? <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> : null}
    </Fragment>
  ));
}

function Block({ block }: { block: LegalBlock }) {
  if ("p" in block) return <p>{withLinks(block.p)}</p>;
  if ("note" in block) return <p className="legal-note">{withLinks(block.note)}</p>;
  if ("ul" in block) return <ul>{block.ul.map((item) => <li key={item}>{withLinks(item)}</li>)}</ul>;
  return (
    <div className="legal-table" role="region" tabIndex={0} aria-label={block.table.head.join(" · ")}>
      <table>
        <thead><tr>{block.table.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) => (
                <td key={index} data-label={block.table.head[index]}>{index === 0 ? <strong>{cell}</strong> : withLinks(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Hüquqi sənədlərin ortaq görünüşü: versiya tarixi, məzmun cədvəli, bölmələr
 * və digər sənədlərə keçid. Mətn seçilmiş dildə serverdə qurulur.
 */
export async function LegalDocument({ kind, docs }: { kind: LegalKind; docs: LegalDocSet }) {
  const [t, language] = await Promise.all([getServerT(), getServerLanguage()]);
  const doc = docs[language] ?? docs.az;
  const [year, month, day] = LEGAL_VERSION.split("-").map(Number);
  const date = `${day} ${t(`month.${month}`)} ${year}`;
  return (
    <main id="main-content" className="route-page legal-page" tabIndex={-1}>
      <PageHeader id={`${kind}-title`} eyebrow={t("legal.eyebrow").replace("{date}", date)} title={doc.title} description={doc.lead} />
      <nav className="legal-switcher" aria-label={t("legalNav.documents")}>
        {NAV.map((item) => (
          <Link key={item.kind} href={item.href} aria-current={item.kind === kind ? "page" : undefined}>{t(item.key)}</Link>
        ))}
      </nav>
      <div className="legal-layout">
        <nav className="legal-toc" aria-label={t("legalNav.contents")}>
          <strong>{t("legalNav.contents")}</strong>
          <ol>
            {doc.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a></li>)}
          </ol>
        </nav>
        <article>
          <p className="legal-meta">{t("legalNav.effective").replace("{date}", date)}</p>
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
              <h2 id={`${section.id}-heading`}>{section.title}</h2>
              {section.blocks.map((block, index) => <Block key={index} block={block} />)}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}

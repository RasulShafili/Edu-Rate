import type { LanguageCode } from "../i18n/config";

/** Hüquqi sənədin blokları: paraqraf, siyahı, cədvəl və ya vurğulanmış qeyd. */
export type LegalBlock =
  | { p: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type LegalDoc = {
  title: string;
  lead: string;
  sections: LegalSection[];
};

export type LegalDocSet = Record<LanguageCode, LegalDoc>;

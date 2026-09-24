import type { LanguageCode } from "./config";

/**
 * Cəm formaları mətndə `|` ilə ayrılır, sıra `Intl.PluralRules` kateqoriyalarına
 * uyğundur: EN "one|other", RU "one|few|many|other". Əvvəl `t()` cəmi bilmirdi və
 * EN-də "1 members", RU-da "2 отзывов" çıxırdı. Azərbaycanca isim saydan sonra tək
 * qalır, ona görə AZ mətnlərində `|` işlənmir.
 *
 * Bu fayl heç nə import etmir (yalnız tip) ki, testlər onu birbaşa yükləyə bilsin.
 */
const PLURAL_ORDER: Record<LanguageCode, readonly Intl.LDMLPluralRule[]> = {
  az: ["one", "other"],
  en: ["one", "other"],
  ru: ["one", "few", "many", "other"],
};

const PLURAL_LOCALE: Record<LanguageCode, string> = {
  az: "az-AZ",
  en: "en-GB",
  ru: "ru-RU",
};

/** Say bəzən artıq formatlanmış sətir kimi gəlir ("1 234"); yalnız rəqəm və ayırıcılar olarsa oxunur. */
function toCount(count: unknown): number {
  if (typeof count === "number") return count;
  if (typeof count === "string" && /^[\d\s  .,]+$/u.test(count)) return Number(count.replace(/\D/gu, ""));
  return Number.NaN;
}

export function selectPluralForm(template: string, language: LanguageCode, count: unknown): string {
  if (!template.includes("|")) return template;
  const forms = template.split("|");
  const value = toCount(count);
  if (!Number.isFinite(value)) return forms[forms.length - 1];
  const category = new Intl.PluralRules(PLURAL_LOCALE[language]).select(value);
  const index = PLURAL_ORDER[language].indexOf(category);
  return forms[index >= 0 && index < forms.length ? index : forms.length - 1];
}

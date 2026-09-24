import type { Metadata } from "next";
import { cookies } from "next/headers";
import { languageCookieName, normalizeLanguage, type LanguageCode } from "./config";
import { baseDictionary, dictionaries, type TranslationKey } from "./dictionaries";

/** Serverdə seçilmiş dil — `edurate_lang` çərəzindən, layout ilə eyni qayda. */
export async function getServerLanguage(): Promise<LanguageCode> {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(languageCookieName)?.value);
}

/** Server tərəfində `t()` — tərcümə yoxdursa azərbaycancaya qayıdır. */
export async function getServerT() {
  const language = await getServerLanguage();
  return (key: TranslationKey | (string & {})) =>
    dictionaries[language]?.[key as TranslationKey] ?? baseDictionary[key as TranslationKey] ?? key;
}

/**
 * Səhifənin başlığı və təsviri seçilmiş dildə (`meta.<key>.title/description`).
 * Əvvəl hər səhifədə statik azərbaycanca `metadata` vardı: EN/RU interfeysdə də
 * brauzer tabında azərbaycanca başlıq görünürdü.
 */
export async function pageMetadata(key: string, extra: Metadata = {}): Promise<Metadata> {
  const t = await getServerT();
  return { title: t(`meta.${key}.title`), description: t(`meta.${key}.description`), ...extra };
}

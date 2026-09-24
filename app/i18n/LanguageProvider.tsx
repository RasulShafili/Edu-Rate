"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLanguage,
  languageCookieName,
  localeByLanguage,
  normalizeLanguage,
  type LanguageCode,
} from "./config";
import { baseDictionary, dictionaries, type TranslationKey } from "./dictionaries";
import { selectPluralForm } from "./plural";

type LanguageContextValue = {
  language: LanguageCode;
  locale: string;
  setLanguage: (language: LanguageCode) => void;
  /** `TranslationKey` avtotamamlama verir; dinamik açarlar üçün sadə string də olur. */
  t: (key: TranslationKey | (string & {}), values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** `{name}` kimi yer tutucuları dəyərlərlə əvəz edir. */
function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/gu, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  /** Serverdə çərəzdən oxunur ki, ilk render düzgün dildə olsun. */
  initialLanguage?: LanguageCode;
}) {
  const [language, setLanguageState] = useState<LanguageCode>(
    initialLanguage ?? defaultLanguage,
  );

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    // Çərəz: server növbəti dəfə düzgün dildə render etsin.
    // `max-age` bir il — seçim yadda qalır.
    document.cookie = `${languageCookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: TranslationKey | (string & {}), values?: Record<string, string | number>) => {
      // Tərcümə yoxdursa azərbaycancaya qayıdırıq — boş mətn heç vaxt çıxmır.
      const typedKey = key as TranslationKey;
      const template = dictionaries[language]?.[typedKey] ?? baseDictionary[typedKey] ?? key;
      return interpolate(selectPluralForm(template, language, values?.count), values);
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, locale: localeByLanguage[language], setLanguage, t }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage yalnız <LanguageProvider> daxilində işləyir.");
  }
  return context;
}

/** Qısa yol: yalnız tərcümə funksiyası lazım olanda. */
export function useT() {
  return useLanguage().t;
}

export { normalizeLanguage };

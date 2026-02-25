"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { UiLocale } from "@/lib/i18n";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useLocale() {
  const { lang, setLang } = useI18n();
  const locale = lang as UiLocale;
  return {
    locale,
    setLocale: (next: UiLocale) => setLang(next),
    toggleLocale: () => setLang(locale === "ko" ? "en" : "ko"),
  };
}

"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { UI_LOCALE_STORAGE_KEY, type UiLocale } from "@/lib/i18n";

type LocaleContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  toggleLocale: () => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>("ko");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(UI_LOCALE_STORAGE_KEY) : null;
    if (stored === "ko" || stored === "en") {
      setLocaleState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(next),
      toggleLocale: () => setLocaleState((prev) => (prev === "ko" ? "en" : "ko")),
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

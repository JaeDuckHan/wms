"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { translateUiText } from "@/lib/i18n";
import { messagesEn } from "@/lib/i18n/messages.en";
import { messagesKo } from "@/lib/i18n/messages.ko";

type Lang = "ko" | "en";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (path: string) => string;
};

const MESSAGES = {
  ko: messagesKo,
  en: messagesEn,
} as const;

const I18nContext = createContext<I18nContextValue | null>(null);

function getByPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang: Lang = "ko";
  const setLang: I18nContextValue["setLang"] = () => {};

  const mergeText = (ko: string, en: string) => {
    const koText = ko.trim();
    const enText = en.trim();
    if (!koText && !enText) return "";
    if (!koText) return enText;
    if (!enText) return koText;
    if (koText === enText) return koText;
    return `${koText} / ${enText}`;
  };

  const t = useMemo(() => {
    return (path: string) => {
      const koValue = getByPath(MESSAGES.ko, path);
      const enValue = getByPath(MESSAGES.en, path);

      if (typeof koValue === "string" || typeof enValue === "string") {
        return mergeText(typeof koValue === "string" ? koValue : "", typeof enValue === "string" ? enValue : "");
      }

      const fallbackKo = translateUiText(path, "ko");
      const fallbackEn = translateUiText(path, "en");
      return mergeText(fallbackKo, fallbackEn);
    };
  }, []);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}


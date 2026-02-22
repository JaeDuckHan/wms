"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { translateUiText } from "@/lib/i18n";

export function TranslatedText({ text }: { text: string }) {
  const { locale } = useLocale();
  return <>{translateUiText(text, locale)}</>;
}

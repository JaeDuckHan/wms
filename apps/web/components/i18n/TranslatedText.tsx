"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

export function TranslatedText({ text }: { text: string }) {
  const { t } = useI18n();
  return <>{t(text)}</>;
}


"use client";

import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    </I18nProvider>
  );
}

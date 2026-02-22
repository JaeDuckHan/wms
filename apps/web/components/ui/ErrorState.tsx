"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/button";
import { translateUiText } from "@/lib/i18n";

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { locale } = useLocale();
  const t = (text: string) => translateUiText(text, locale);

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-red-700">{t(title)}</p>
          {message && <p className="mt-1 text-xs text-red-600">{message}</p>}
        </div>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            {t("Retry")}
          </Button>
        )}
      </div>
    </div>
  );
}

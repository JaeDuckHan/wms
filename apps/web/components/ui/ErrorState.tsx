"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/I18nProvider";
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

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



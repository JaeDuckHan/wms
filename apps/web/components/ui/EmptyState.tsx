"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
export function EmptyState({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border bg-white px-6 py-8 text-center">
      {icon && <div className="mb-2 flex justify-center text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-700">{t(title)}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{t(description)}</p>}
      {actions && <div className="mt-4 flex justify-center">{actions}</div>}
    </div>
  );
}



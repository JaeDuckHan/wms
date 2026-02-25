"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n/I18nProvider";
type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
  subtitle,
  rightSlot,
}: {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  actions?: ReactNode;
  subtitle?: string;
  rightSlot?: ReactNode;
}) {
  const { t } = useI18n();
  const toStackedLabel = (text: string) => text.replace(" / ", "\n");
  const summary = description ?? subtitle;
  const actionSlot = actions ?? rightSlot;

  return (
    <div className="mb-6 flex flex-col gap-4">
      {!!breadcrumbs?.length && (
        <nav className="flex items-center gap-2 text-xs text-slate-500">
          {breadcrumbs.map((item, idx) => (
            <div key={item.label} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="h-3 w-3" />}
              {item.href ? (
                <Link href={item.href} className="whitespace-pre-line leading-tight">
                  {toStackedLabel(t(item.label))}
                </Link>
              ) : (
                <span className="whitespace-pre-line leading-tight">{toStackedLabel(t(item.label))}</span>
              )}
            </div>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="whitespace-pre-line text-2xl font-semibold leading-tight text-slate-900">
            {toStackedLabel(t(title))}
          </h1>
          {summary && <p className="mt-1 text-sm text-slate-500">{t(summary)}</p>}
        </div>
        {actionSlot}
      </div>
    </div>
  );
}



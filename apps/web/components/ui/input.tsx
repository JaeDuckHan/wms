"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
export function Input({
  className,
  placeholder,
  title,
  "aria-label": ariaLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useI18n();
  const nextPlaceholder = typeof placeholder === "string" ? t(placeholder) : placeholder;
  const nextTitle = typeof title === "string" ? t(title) : title;
  const nextAriaLabel = typeof ariaLabel === "string" ? t(ariaLabel) : ariaLabel;

  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-300",
        className
      )}
      placeholder={nextPlaceholder}
      title={nextTitle}
      aria-label={nextAriaLabel}
      {...props}
    />
  );
}



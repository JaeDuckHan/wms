"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { translateUiText } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-slate-200 bg-slate-50 text-slate-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        danger: "border-red-200 bg-red-50 text-red-700",
        info: "border-blue-200 bg-blue-50 text-blue-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, title, "aria-label": ariaLabel, ...props }: BadgeProps) {
  const { locale } = useLocale();
  const t = (text: string) => translateUiText(text, locale);
  const nextChildren = typeof children === "string" ? t(children) : children;
  const nextTitle = typeof title === "string" ? t(title) : title;
  const nextAriaLabel = typeof ariaLabel === "string" ? t(ariaLabel) : ariaLabel;

  return (
    <div className={cn(badgeVariants({ variant }), className)} title={nextTitle} aria-label={nextAriaLabel} {...props}>
      {nextChildren}
    </div>
  );
}

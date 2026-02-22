"use client";

import * as React from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { translateUiText } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border bg-white text-slate-900 shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { locale } = useLocale();
  const t = (text: string) => translateUiText(text, locale);
  const nextChildren = typeof children === "string" ? t(children) : children;
  return (
    <h3 className={cn("text-sm font-semibold", className)} {...props}>
      {nextChildren}
    </h3>
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

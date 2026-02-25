"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full caption-bottom text-sm", className)} {...props} />;
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b hover:bg-slate-50/80", className)} {...props} />;
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { t } = useI18n();
  const nextChildren = typeof children === "string" ? t(children) : children;
  return (
    <th
      className={cn("h-11 px-4 text-left align-middle text-xs font-medium text-slate-500", className)}
      {...props}
    >
      {nextChildren}
    </th>
  );
}

export function TableCell({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const { t } = useI18n();
  const nextChildren = typeof children === "string" ? t(children) : children;
  return (
    <td className={cn("p-4 align-middle", className)} {...props}>
      {nextChildren}
    </td>
  );
}



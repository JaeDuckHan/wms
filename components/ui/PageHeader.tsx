import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  rightSlot,
}: {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        {breadcrumbs.map((item, idx) => (
          <div key={item.label} className="flex items-center gap-2">
            {idx > 0 && <ChevronRight className="h-3 w-3" />}
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {rightSlot}
      </div>
    </div>
  );
}

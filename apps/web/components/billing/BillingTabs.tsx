"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { translateUiText } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/billing", label: "Invoices" },
  { href: "/billing/events", label: "Billing Events" },
];

export function BillingTabs() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = (text: string) => translateUiText(text, locale);

  return (
    <div className="mb-6 rounded-xl border bg-white p-1">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {t(tab.label)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

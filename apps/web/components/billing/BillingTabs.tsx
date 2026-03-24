"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCurrentUser } from "@/features/auth/useCurrentUser";

export function BillingTabs() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { canAccessBillingEvents } = useCurrentUser();
  const tabs = [
    canAccessBillingEvents ? { href: "/billing/events", label: "Billing Events" } : null,
    { href: "/billing", label: "Invoices" },
  ].filter(Boolean) as Array<{ href: string; label: string }>;

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



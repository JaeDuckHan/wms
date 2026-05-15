"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCurrentUser } from "@/features/auth/useCurrentUser";

export function SettingsTabs() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { canAccessSettings, canManageBillingSettings } = useCurrentUser();

  if (!canAccessSettings) {
    return null;
  }

  const tabs = [
    { href: "/settings/clients", label: "Clients" },
    { href: "/settings/products", label: "Products" },
    { href: "/settings/warehouses", label: "Warehouses" },
    { href: "/settings/sales-channels", label: "Sales Channels" },
    canManageBillingSettings ? { href: "/settings/service-rates", label: "Service Rates" } : null,
    canManageBillingSettings ? { href: "/settings/contract-rates", label: "Contract Rates" } : null,
    canManageBillingSettings ? { href: "/settings/storage-rates", label: "Storage Rates" } : null,
    canManageBillingSettings ? { href: "/settings/exchange-rates", label: "Exchange Rates" } : null,
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



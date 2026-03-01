"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Download, FileText, House, LogOut, Send, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/features/auth/api";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function Sidebar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useToast();

  const items = [
    { href: "/inbounds", label: "nav.inbounds", icon: Download },
    { href: "/outbounds", label: "nav.outbounds", icon: Send },
    { href: "/inventory", label: "nav.inventory", icon: Boxes },
    { href: "/billing", label: "nav.billing", icon: FileText },
    { href: "/dashboard", label: "nav.dashboard", icon: House },
    { href: "/settings", label: "nav.settings", icon: Settings },
  ];
  const toStackedLabel = (text: string) => text.replace(" / ", "\n");

  const handleLogout = () => {
    logout();
    pushToast({ title: t("common.signedOut"), variant: "info" });
    router.push("/login");
  };

  return (
    <aside className="w-[240px] border-r bg-white px-3 py-6">
      <Link href="/dashboard" className="mb-6 block cursor-pointer rounded-md px-3 py-1 hover:bg-slate-100">
        <p className="text-xs text-slate-500">{t("sidebar.product")}</p>
        <h2 className="mt-1 text-base font-semibold">{t("sidebar.console")}</h2>
      </Link>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-pre-line leading-tight">{toStackedLabel(t(item.label))}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 px-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" />
          {t("sidebar.logout")}
        </button>
      </div>
    </aside>
  );
}

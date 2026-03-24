"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Bell, BookOpenText, Search, UserCircle2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/api";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getDataMode, getDataModeLabel } from "@/lib/runtime-mode";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

export function Topbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { pushToast } = useToast();
  const { t } = useI18n();

  const initialQuery = useMemo(() => searchParams.get("q") ?? "", [searchParams]);
  const [query, setQuery] = useState(initialQuery);
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const tokenCookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_KEY}=`));
    setToken(tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : undefined);
  }, []);

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    const nextPath = pathname.startsWith("/inbounds")
      ? pathname
      : pathname.startsWith("/outbounds")
        ? pathname
        : "/outbounds";
    router.push(`${nextPath}?${params.toString()}`);
  };

  const onLogout = () => {
    logout();
    pushToast({ title: t("Signed out"), variant: "info" });
    router.push("/login");
  };

  const dataMode = getDataMode(token);
  const dataModeLabel = getDataModeLabel(token);
  const dataModeClassName =
    dataMode === "mock"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : dataMode === "mock-fallback"
        ? "border-orange-200 bg-orange-50 text-orange-700"
      : dataMode === "live-strict"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white px-6">
      <form onSubmit={onSearch} className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={t("Search orders, clients, products...")}
          className="pl-9"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="ml-4 flex items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${dataModeClassName}`}>
          {dataModeLabel}
        </span>
        <Link href="/guide">
          <Button variant="secondary" size="sm">
            <BookOpenText className="h-4 w-4" />
            사용 가이드 / Guide
          </Button>
        </Link>
        <button type="button" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
          <Bell className="h-5 w-5" />
        </button>
        <Button variant="secondary" size="sm" onClick={onLogout}>
          <UserCircle2 className="h-4 w-4" />
          {t("Admin")}
        </Button>
      </div>
    </header>
  );
}

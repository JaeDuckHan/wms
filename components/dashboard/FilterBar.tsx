"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeDateInput, normalizeMonthInput } from "@/components/dashboard/filterUtils";

export type FilterBarValues = {
  [key: string]: string | undefined;
  from?: string;
  to?: string;
  date?: string;
  month?: string;
  warehouseId?: string;
  clientId?: string;
};

type FilterBarProps = {
  mode: "date-range" | "date" | "month";
  values: FilterBarValues;
  loading?: boolean;
  validationError?: string | null;
  onChange: (next: FilterBarValues) => void;
  onSubmit: () => void;
  onReset: () => void;
  children?: ReactNode;
  hideWarehouse?: boolean;
  hideClient?: boolean;
  queryKeys?: string[];
  syncToUrl?: boolean;
};

export function FilterBar({
  mode,
  values,
  loading,
  validationError,
  onChange,
  onSubmit,
  onReset,
  children,
  hideWarehouse,
  hideClient,
  queryKeys,
  syncToUrl = true,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const syncQuery = (nextValues: FilterBarValues, keys: string[]) => {
    if (!syncToUrl) return;
    const params = new URLSearchParams(searchParams.toString());
    for (const key of keys) params.delete(key);
    for (const key of keys) {
      const value = nextValues[key]?.trim();
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const keysToSync = queryKeys ?? Object.keys(values);

  return (
    <form
      className="rounded-xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        syncQuery(values, keysToSync);
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-6">
        {mode === "date-range" && (
          <>
            <Input
              placeholder="from YYYY-MM-DD"
              value={values.from ?? ""}
              onChange={(e) => onChange({ ...values, from: normalizeDateInput(e.target.value) })}
            />
            <Input
              placeholder="to YYYY-MM-DD"
              value={values.to ?? ""}
              onChange={(e) => onChange({ ...values, to: normalizeDateInput(e.target.value) })}
            />
          </>
        )}
        {mode === "date" && (
          <Input
            placeholder="date YYYY-MM-DD"
            value={values.date ?? ""}
            onChange={(e) => onChange({ ...values, date: normalizeDateInput(e.target.value) })}
          />
        )}
        {mode === "month" && (
          <Input
            placeholder="month YYYY-MM"
            value={values.month ?? ""}
            onChange={(e) => onChange({ ...values, month: normalizeMonthInput(e.target.value) })}
          />
        )}

        {!hideWarehouse && (
          <Input
            placeholder="warehouseId"
            value={values.warehouseId ?? ""}
            onChange={(e) => onChange({ ...values, warehouseId: e.target.value.replace(/\D/g, "") })}
          />
        )}
        {!hideClient && (
          <Input
            placeholder="clientId"
            value={values.clientId ?? ""}
            onChange={(e) => onChange({ ...values, clientId: e.target.value.replace(/\D/g, "") })}
          />
        )}
        {children}
        <Button type="submit" disabled={loading || !!validationError}>
          {loading ? "Loading..." : "Load"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onReset();
            syncQuery({}, keysToSync);
          }}
        >
          Reset
        </Button>
      </div>
      <div className="mt-2 text-xs text-slate-500">Press Enter to submit.</div>
      {validationError && <p className="mt-2 text-sm text-red-600">{validationError}</p>}
    </form>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Copy, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FilterBarSkeleton, SummaryCardsSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { GenerateSnapshotsButton } from "@/components/dashboard/GenerateSnapshotsButton";
import { isMonthInput } from "@/components/dashboard/filterUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStorageBillingPreview, type StorageBillingResponse } from "@/features/dashboard/api";
import {
  compareNumber,
  downloadCsv,
  formatCbm,
  formatMoney,
  readFiltersFromSearchParams,
  safeNumber,
  toCsv,
  type SortDirection,
  writeFiltersToUrl,
} from "@/features/dashboard/utils";
import { useToast } from "@/components/ui/toast";

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function isNonNegativeNumber(value: string) {
  return value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0);
}

type BillingSortKey = "days_count" | "avg_cbm" | "avg_pallet" | "amount_total";

export function StorageBillingPage() {
  const { pushToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultFilters = useMemo(
    () => ({
      month: thisMonth(),
      warehouseId: "",
      clientId: "",
      rateCbm: "",
      ratePallet: "",
    }),
    []
  );
  const initialFilters = useMemo(
    () => readFiltersFromSearchParams(searchParams, defaultFilters),
    [defaultFilters, searchParams]
  );

  const [month, setMonth] = useState(initialFilters.month);
  const [warehouseId, setWarehouseId] = useState(initialFilters.warehouseId);
  const [clientId, setClientId] = useState(initialFilters.clientId);
  const [rateCbm, setRateCbm] = useState(initialFilters.rateCbm);
  const [ratePallet, setRatePallet] = useState(initialFilters.ratePallet);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<BillingSortKey>("amount_total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StorageBillingResponse | null>(null);

  const validationError = useMemo(() => {
    if (!isMonthInput(month)) return "month must use YYYY-MM format.";
    if (warehouseId && !/^\d+$/.test(warehouseId)) return "warehouseId must be a positive integer.";
    if (clientId && !/^\d+$/.test(clientId)) return "clientId must be a positive integer.";
    if (!isNonNegativeNumber(rateCbm)) return "rateCbm must be a number >= 0.";
    if (!isNonNegativeNumber(ratePallet)) return "ratePallet must be a number >= 0.";
    return null;
  }, [month, warehouseId, clientId, rateCbm, ratePallet]);

  const load = useCallback(async () => {
    if (validationError) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getStorageBillingPreview({
        month,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
        rateCbm: rateCbm ? Number(rateCbm) : undefined,
        ratePallet: ratePallet ? Number(ratePallet) : undefined,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing preview.");
    } finally {
      setLoading(false);
    }
  }, [clientId, month, rateCbm, ratePallet, validationError, warehouseId]);

  useEffect(() => {
    void load();
    // Intentionally load once for the initial URL-driven state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tableRows = useMemo(() => {
    if (!data?.lines?.length) return [];
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? data.lines.filter((row) => {
          const warehouseText = String(row.warehouse_id).toLowerCase();
          const clientText = String(row.client_id).toLowerCase();
          return warehouseText.includes(keyword) || clientText.includes(keyword);
        })
      : data.lines;

    return [...filtered].sort((a, b) => {
      return compareNumber(a[sortKey], b[sortKey], sortDirection);
    });
  }, [data?.lines, search, sortDirection, sortKey]);

  const reset = () => {
    setMonth(defaultFilters.month);
    setWarehouseId(defaultFilters.warehouseId);
    setClientId(defaultFilters.clientId);
    setRateCbm(defaultFilters.rateCbm);
    setRatePallet(defaultFilters.ratePallet);
    setSearch("");
    writeFiltersToUrl(router, pathname, {});
  };

  const applyFilters = () => {
    writeFiltersToUrl(router, pathname, { month, rateCbm, ratePallet, warehouseId, clientId });
    void load();
  };

  const toggleSort = (next: BillingSortKey) => {
    if (sortKey === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(next);
    setSortDirection("desc");
  };

  const copyJson = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      pushToast({ title: "Copied JSON", variant: "success" });
    } catch {
      pushToast({ title: "Copy failed", variant: "error" });
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      tableRows.map((row) => ({
        warehouse_id: safeNumber(row.warehouse_id),
        client_id: safeNumber(row.client_id),
        days_count: safeNumber(row.days_count),
        avg_cbm: safeNumber(row.avg_cbm),
        avg_pallet: safeNumber(row.avg_pallet),
        amount_total: safeNumber(row.amount_total),
      })),
      [
        { key: "warehouse_id", label: "warehouse_id" },
        { key: "client_id", label: "client_id" },
        { key: "days_count", label: "days_count" },
        { key: "avg_cbm", label: "avg_cbm" },
        { key: "avg_pallet", label: "avg_pallet" },
        { key: "amount_total", label: "amount_total" },
      ]
    );
    downloadCsv(`storage-billing-${month}.csv`, csv);
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Storage Billing" }]}
        title="Storage Billing Preview"
        description="Monthly storage billing simulation."
        actions={
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void copyJson()} disabled={!data}>
              <Copy className="h-4 w-4" />
              Copy JSON
            </Button>
          </div>
        }
      />
      <DashboardTabs />

      {loading && !data ? <FilterBarSkeleton /> : null}
      <FilterBar
        mode="month"
        values={{ month, warehouseId, clientId, rateCbm, ratePallet, search }}
        loading={loading}
        validationError={validationError}
        onChange={(next) => {
          setMonth(next.month ?? "");
          setWarehouseId(next.warehouseId ?? "");
          setClientId(next.clientId ?? "");
        }}
        onSubmit={applyFilters}
        onReset={reset}
        syncToUrl={false}
      >
        <Input
          placeholder="rateCbm"
          value={rateCbm}
          onChange={(e) => setRateCbm(e.target.value)}
          inputMode="decimal"
        />
        <Input
          placeholder="ratePallet"
          value={ratePallet}
          onChange={(e) => setRatePallet(e.target.value)}
          inputMode="decimal"
        />
      </FilterBar>

      {error && (
        <div className="mb-4">
          <ErrorState title="Failed to load billing preview" message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? <SummaryCardsSkeleton /> : null}
      {!loading && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Amount Total</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(data?.summary.amount_total ?? 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Amount CBM</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(data?.summary.amount_cbm ?? 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Amount Pallet</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(data?.summary.amount_pallet ?? 0)}</CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Billing Lines</CardTitle>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              placeholder="Search warehouse_id/client_id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:w-64"
            />
            <Button type="button" variant="secondary" onClick={exportCsv} disabled={!tableRows.length}>
              <Download className="h-4 w-4" />
              CSV export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} />
          ) : !tableRows.length ? (
            <EmptyState
              title="No billing lines"
              description="Try removing filters or generate recent snapshots for demo data."
              actions={
                <GenerateSnapshotsButton
                  warehouseId={warehouseId ? Number(warehouseId) : undefined}
                  clientId={clientId ? Number(clientId) : undefined}
                />
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>warehouse_id</TableHead>
                    <TableHead>client_id</TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("days_count")}>
                        days_count
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("avg_cbm")}>
                        avg_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("avg_pallet")}>
                        avg_pallet
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("amount_total")}>
                        amount_total
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={`${row.warehouse_id}-${row.client_id}`}>
                      <TableCell>{row.warehouse_id}</TableCell>
                      <TableCell>{row.client_id}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span>{safeNumber(row.days_count).toLocaleString()}</span>
                          {row.days_count < 20 ? <Badge variant="warning">insufficient snapshot days</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCbm(row.avg_cbm)}</TableCell>
                      <TableCell className="text-right">{formatCbm(row.avg_pallet)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.amount_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}


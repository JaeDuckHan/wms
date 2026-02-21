"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownUp, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FilterBarSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { GenerateSnapshotsButton } from "@/components/dashboard/GenerateSnapshotsButton";
import { isDateInput } from "@/components/dashboard/filterUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStorageCapacity, type CapacityStatus, type StorageCapacityResponse } from "@/features/dashboard/api";
import {
  compareNumber,
  downloadCsv,
  formatCbm,
  formatPct,
  readFiltersFromSearchParams,
  safeNumber,
  toCsv,
  type SortDirection,
  writeFiltersToUrl,
} from "@/features/dashboard/utils";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatusCell({ status }: { status: CapacityStatus }) {
  if (status === "critical") return <Badge variant="danger">critical</Badge>;
  if (status === "warn") return <Badge variant="warning">warn</Badge>;
  return <Badge variant="success">ok</Badge>;
}

function UsageProgress({ usagePct, capacityCbm }: { usagePct: number | null; capacityCbm: number | null }) {
  if (safeNumber(capacityCbm) <= 0) {
    return <span className="text-xs text-slate-500">capacity not set</span>;
  }
  const clamped = Math.min(Math.max(safeNumber(usagePct), 0), 100);
  const tone = clamped >= 95 ? "bg-red-500" : clamped >= 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="min-w-12 text-right">{formatPct(usagePct)}</span>
    </div>
  );
}

type CapacitySortKey = "used_cbm" | "capacity_cbm" | "usage_pct_cbm";

export function CapacityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultFilters = useMemo(
    () => ({
      date: today(),
      warehouseId: "",
    }),
    []
  );
  const initialFilters = useMemo(
    () => readFiltersFromSearchParams(searchParams, defaultFilters),
    [defaultFilters, searchParams]
  );

  const [date, setDate] = useState(initialFilters.date);
  const [warehouseId, setWarehouseId] = useState(initialFilters.warehouseId);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<CapacitySortKey>("usage_pct_cbm");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StorageCapacityResponse | null>(null);

  const validationError = useMemo(() => {
    if (!isDateInput(date)) return "date must use YYYY-MM-DD format.";
    if (warehouseId && !/^\d+$/.test(warehouseId)) return "warehouseId must be a positive integer.";
    return null;
  }, [date, warehouseId]);

  const load = useCallback(async () => {
    if (validationError) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getStorageCapacity({
        date,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load capacity.");
    } finally {
      setLoading(false);
    }
  }, [date, validationError, warehouseId]);

  useEffect(() => {
    void load();
    // Intentionally load once for the initial URL-driven state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alertRows = useMemo(() => {
    const rows = data?.warehouses ?? [];
    const severity = (status: CapacityStatus) => {
      if (status === "critical") return 0;
      if (status === "warn") return 1;
      return 2;
    };
    return rows
      .filter((row) => row.status !== "ok")
      .sort((a, b) => {
        const byStatus = severity(a.status) - severity(b.status);
        if (byStatus !== 0) return byStatus;
        return safeNumber(b.usage_pct_cbm) - safeNumber(a.usage_pct_cbm);
      });
  }, [data?.warehouses]);

  const tableRows = useMemo(() => {
    const rows = data?.warehouses ?? [];
    const keyword = search.trim().toLowerCase();
    const filtered = keyword ? rows.filter((row) => String(row.warehouse_id).toLowerCase().includes(keyword)) : rows;
    return [...filtered].sort((a, b) => compareNumber(a[sortKey], b[sortKey], sortDirection));
  }, [data?.warehouses, search, sortDirection, sortKey]);

  const reset = () => {
    setDate(defaultFilters.date);
    setWarehouseId(defaultFilters.warehouseId);
    setSearch("");
    writeFiltersToUrl(router, pathname, {});
  };

  const applyFilters = () => {
    writeFiltersToUrl(router, pathname, { date, warehouseId });
    void load();
  };

  const toggleSort = (next: CapacitySortKey) => {
    if (sortKey === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(next);
    setSortDirection("desc");
  };

  const exportCsv = () => {
    const csv = toCsv(
      tableRows.map((row) => ({
        warehouse_id: safeNumber(row.warehouse_id),
        used_cbm: safeNumber(row.used_cbm),
        capacity_cbm: row.capacity_cbm ?? "",
        usage_pct_cbm: row.usage_pct_cbm ?? "",
        status: row.status,
        used_pallet: safeNumber(row.used_pallet),
        capacity_pallet: row.capacity_pallet ?? "",
        usage_pct_pallet: row.usage_pct_pallet ?? "",
      })),
      [
        { key: "warehouse_id", label: "warehouse_id" },
        { key: "used_cbm", label: "used_cbm" },
        { key: "capacity_cbm", label: "capacity_cbm" },
        { key: "usage_pct_cbm", label: "usage_pct_cbm" },
        { key: "status", label: "status" },
        { key: "used_pallet", label: "used_pallet" },
        { key: "capacity_pallet", label: "capacity_pallet" },
        { key: "usage_pct_pallet", label: "usage_pct_pallet" },
      ]
    );
    downloadCsv(`storage-capacity-${date}.csv`, csv);
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Capacity" }]}
        title="Warehouse Capacity"
        description="Usage monitoring with risk alerts."
      />
      <DashboardTabs />

      <Card className="mb-4 border-amber-200 bg-amber-50">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!alertRows.length ? (
            <p className="text-sm text-amber-800">All warehouses are currently in ok status.</p>
          ) : (
            <div className="space-y-2">
              {alertRows.map((row) => (
                <div
                  key={`alert-${row.warehouse_id}`}
                  className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <StatusCell status={row.status} />
                    <span>
                      Warehouse {row.warehouse_id} · {formatCbm(row.used_cbm)} / {row.capacity_cbm == null ? "-" : formatCbm(row.capacity_cbm)} CBM
                      {row.capacity_cbm == null ? "" : ` (${formatPct(row.usage_pct_cbm)})`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && !data ? <FilterBarSkeleton /> : null}
      <FilterBar
        mode="date"
        values={{ date, warehouseId, search }}
        loading={loading}
        validationError={validationError}
        onChange={(next) => {
          setDate(next.date ?? "");
          setWarehouseId(next.warehouseId ?? "");
        }}
        onSubmit={applyFilters}
        onReset={reset}
        hideClient
        syncToUrl={false}
      />

      {error && (
        <div className="mb-4">
          <ErrorState title="Failed to load capacity" message={error} onRetry={() => void load()} />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Warehouses</CardTitle>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              placeholder="Search warehouse_id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:w-56"
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
              title="No warehouse capacity rows"
              description="Try a different date or generate recent snapshots for demo data."
              actions={<GenerateSnapshotsButton warehouseId={warehouseId ? Number(warehouseId) : undefined} />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>warehouse_id</TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("used_cbm")}>
                        used_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("capacity_cbm")}>
                        capacity_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("usage_pct_cbm")}>
                        usage_pct_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>status</TableHead>
                    <TableHead className="text-right">used_pallet</TableHead>
                    <TableHead className="text-right">capacity_pallet</TableHead>
                    <TableHead className="text-right">usage_pct_pallet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.warehouse_id}>
                      <TableCell>{row.warehouse_id}</TableCell>
                      <TableCell className="text-right">{formatCbm(row.used_cbm)}</TableCell>
                      <TableCell className="text-right">{row.capacity_cbm == null ? "-" : formatCbm(row.capacity_cbm)}</TableCell>
                      <TableCell className="text-right">
                        <UsageProgress usagePct={row.usage_pct_cbm} capacityCbm={row.capacity_cbm} />
                      </TableCell>
                      <TableCell>
                        <StatusCell status={row.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCbm(row.used_pallet)}</TableCell>
                      <TableCell className="text-right">{row.capacity_pallet == null ? "-" : formatCbm(row.capacity_pallet)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.usage_pct_pallet)}</TableCell>
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


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { FilterBarSkeleton, SummaryCardsSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { GenerateSnapshotsButton } from "@/components/dashboard/GenerateSnapshotsButton";
import { isDateInput } from "@/components/dashboard/filterUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStorageTrend, type GroupBy, type StorageTrendResponse } from "@/features/dashboard/api";
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

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function enumerateDates(from: string, to: string) {
  const items: string[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    items.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return items;
}

function TrendLineChart({ points }: { points: Array<{ x: string; y: number }> }) {
  const width = 640;
  const height = 220;
  const pad = 24;
  const maxY = Math.max(...points.map((p) => p.y), 0);

  if (!points.length || maxY <= 0) {
    return <EmptyState title="No chart data" description="Load data with non-zero CBM values." />;
  }

  const xy = points.map((point, idx) => {
    const x = pad + (idx * (width - pad * 2)) / Math.max(points.length - 1, 1);
    const y = height - pad - (point.y / maxY) * (height - pad * 2);
    return { x, y, label: point.x };
  });
  const polyline = xy.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full min-w-[480px]">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" />
        <polyline fill="none" stroke="#0f172a" strokeWidth="2.5" points={polyline} />
        {xy.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="3" fill="#0f172a" />
          </g>
        ))}
      </svg>
    </div>
  );
}

type TrendSortKey = "total_cbm" | "total_pallet" | "total_sku" | "delta_pct";

export function StorageTrendPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultFilters = useMemo(
    () => ({
      from: thirtyDaysAgo(),
      to: today(),
      groupBy: "day",
      warehouseId: "",
      clientId: "",
    }),
    []
  );
  const initialFilters = useMemo(
    () => readFiltersFromSearchParams(searchParams, defaultFilters),
    [defaultFilters, searchParams]
  );

  const [from, setFrom] = useState(initialFilters.from);
  const [to, setTo] = useState(initialFilters.to);
  const [groupBy, setGroupBy] = useState<GroupBy>(initialFilters.groupBy as GroupBy);
  const [warehouseId, setWarehouseId] = useState(initialFilters.warehouseId);
  const [clientId, setClientId] = useState(initialFilters.clientId);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<TrendSortKey>("total_cbm");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StorageTrendResponse | null>(null);

  const validationError = useMemo(() => {
    if (!isDateInput(from) || !isDateInput(to)) return "from/to must use YYYY-MM-DD format.";
    if (from > to) return "from cannot be later than to.";
    if (warehouseId && !/^\d+$/.test(warehouseId)) return "warehouseId must be a positive integer.";
    if (clientId && !/^\d+$/.test(clientId)) return "clientId must be a positive integer.";
    return null;
  }, [from, to, warehouseId, clientId]);

  const load = useCallback(async () => {
    if (validationError) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getStorageTrend({
        from,
        to,
        groupBy,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trend.");
    } finally {
      setLoading(false);
    }
  }, [clientId, from, groupBy, to, validationError, warehouseId]);

  useEffect(() => {
    void load();
    // Intentionally load once for the initial URL-driven state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filledSeries = useMemo(() => {
    if (!data?.series?.length) return [];
    const sorted = [...data.series].sort((a, b) => a.period.localeCompare(b.period));
    if (groupBy !== "day") return sorted;

    const byPeriod = new Map(sorted.map((row) => [row.period, row]));
    return enumerateDates(from, to).map((period) => {
      const row = byPeriod.get(period);
      return (
        row ?? {
          period,
          total_cbm: 0,
          total_pallet: 0,
          total_sku: 0,
        }
      );
    });
  }, [data?.series, from, groupBy, to]);

  const seriesWithDelta = useMemo(() => {
    return filledSeries.map((row, index) => {
      if (index === 0) return { ...row, delta_pct: null as number | null };
      const prev = safeNumber(filledSeries[index - 1]?.total_cbm);
      const current = safeNumber(row.total_cbm);
      if (prev <= 0) {
        return { ...row, delta_pct: null };
      }
      return {
        ...row,
        delta_pct: ((current - prev) / prev) * 100,
      };
    });
  }, [filledSeries]);

  const displayTotals = useMemo(() => {
    return filledSeries.reduce(
      (acc, row) => ({
        total_cbm: acc.total_cbm + safeNumber(row.total_cbm),
        total_pallet: acc.total_pallet + safeNumber(row.total_pallet),
        total_sku: acc.total_sku + safeNumber(row.total_sku),
      }),
      { total_cbm: 0, total_pallet: 0, total_sku: 0 }
    );
  }, [filledSeries]);

  const tableRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? seriesWithDelta.filter((row) => row.period.toLowerCase().includes(keyword))
      : seriesWithDelta;

    return [...filtered].sort((a, b) => {
      return compareNumber(a[sortKey] as number | null, b[sortKey] as number | null, sortDirection);
    });
  }, [search, seriesWithDelta, sortDirection, sortKey]);

  const toggleSort = (next: TrendSortKey) => {
    if (sortKey === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(next);
    setSortDirection("desc");
  };

  const reset = () => {
    setFrom(defaultFilters.from);
    setTo(defaultFilters.to);
    setGroupBy(defaultFilters.groupBy as GroupBy);
    setWarehouseId(defaultFilters.warehouseId);
    setClientId(defaultFilters.clientId);
    setSearch("");
    writeFiltersToUrl(router, pathname, {});
  };

  const applyFilters = () => {
    writeFiltersToUrl(router, pathname, { from, to, groupBy, warehouseId, clientId });
    void load();
  };

  const exportCsv = () => {
    const csv = toCsv(
      tableRows.map((row) => ({
        period: row.period,
        total_cbm: safeNumber(row.total_cbm),
        total_pallet: safeNumber(row.total_pallet),
        total_sku: safeNumber(row.total_sku),
        delta_pct: row.delta_pct ?? "",
      })),
      [
        { key: "period", label: "period" },
        { key: "total_cbm", label: "total_cbm" },
        { key: "total_pallet", label: "total_pallet" },
        { key: "total_sku", label: "total_sku" },
        { key: "delta_pct", label: "delta_pct" },
      ]
    );
    downloadCsv(`storage-trend-${from}-${to}.csv`, csv);
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Storage Trend" }]}
        title="Storage Trend"
        description="Trend of storage usage by period."
      />
      <DashboardTabs />

      {loading && !data ? <FilterBarSkeleton /> : null}
      <FilterBar
        mode="date-range"
        values={{ from, to, warehouseId, clientId, groupBy, search }}
        loading={loading}
        validationError={validationError}
        onChange={(next) => {
          setFrom(next.from ?? "");
          setTo(next.to ?? "");
          setWarehouseId(next.warehouseId ?? "");
          setClientId(next.clientId ?? "");
        }}
        onSubmit={applyFilters}
        onReset={reset}
        syncToUrl={false}
      >
        <select
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
        >
          <option value="day">day</option>
          <option value="week">week</option>
          <option value="month">month</option>
        </select>
      </FilterBar>

      {error && (
        <div className="mb-4">
          <ErrorState title="Failed to load storage trend" message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? <SummaryCardsSkeleton /> : null}
      {!loading && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total CBM</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCbm(displayTotals.total_cbm)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Pallet</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCbm(displayTotals.total_pallet)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total SKU</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{safeNumber(displayTotals.total_sku).toLocaleString()}</CardContent>
          </Card>
        </div>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>CBM Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} />
          ) : filledSeries.length ? (
            <TrendLineChart points={filledSeries.map((item) => ({ x: item.period, y: safeNumber(item.total_cbm) }))} />
          ) : (
            <EmptyState
              title="No trend data yet"
              description="Try widening the date range or generate recent snapshots for demo data."
              actions={
                <GenerateSnapshotsButton
                  warehouseId={warehouseId ? Number(warehouseId) : undefined}
                  clientId={clientId ? Number(clientId) : undefined}
                />
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Trend Table</CardTitle>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              placeholder="Search period"
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
              title="No rows"
              description="No trend rows to display for current filters."
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
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("total_cbm")}>
                        CBM
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("total_pallet")}>
                        Pallet
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("total_sku")}>
                        SKU
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("delta_pct")}>
                        Delta
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.period}>
                      <TableCell>{row.period}</TableCell>
                      <TableCell className="text-right">{formatCbm(row.total_cbm)}</TableCell>
                      <TableCell className="text-right">{formatCbm(row.total_pallet)}</TableCell>
                      <TableCell className="text-right">{safeNumber(row.total_sku).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatPct(row.delta_pct)}</TableCell>
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


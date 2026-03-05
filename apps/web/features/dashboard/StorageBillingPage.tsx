"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Copy, Download, ImageDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { CardsSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { GenerateSnapshotsButton } from "@/components/dashboard/GenerateSnapshotsButton";
import { DemoModeBanner, DemoModeToggle } from "@/components/dashboard/DemoModeToggle";
import {
  stickyHeaderClass,
  stickyIntersectionClass,
  stickyLeftClass,
  stickyTableClass,
  StickyTableContainer,
} from "@/components/dashboard/StickyTable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getStorageBillingPreview,
  getStorageBillingSkuPreview,
  type StorageBillingResponse,
  type StorageBillingSkuResponse
} from "@/features/dashboard/api";
import { captureElementToPng } from "@/features/dashboard/capture";
import { normalizeInt, normalizeMonth } from "@/features/dashboard/input";
import { useDashboardToast } from "@/features/dashboard/toast";
import { useDemoMode } from "@/features/dashboard/useDemoMode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  compareNumber,
  copyToClipboard,
  downloadCsv,
  formatCbm,
  formatMoney,
  readFiltersFromSearchParams,
  safeNumber,
  toCsv,
  toTsv,
  type CsvColumn,
  type SortDirection,
  writeFiltersToUrl,
} from "@/features/dashboard/utils";

function thisMonth() {
  return new Date().toISOString().slice(0, 7);
}

function isNonNegativeNumber(value: string) {
  return value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0);
}

type BillingSortKey = "days_count" | "avg_cbm" | "rate_cbm" | "amount_cbm" | "amount_total";

type BillingFilters = {
  month: string;
  warehouseId: string;
  clientId: string;
  rateCbm: string;
  ratePallet: string;
};

const billingColumns = [
  { key: "warehouse_id", label: "warehouse_id" },
  { key: "warehouse_name", label: "warehouse_name" },
  { key: "client_id", label: "client_id" },
  { key: "client_name", label: "client_name" },
  { key: "sku_count", label: "sku_count" },
  { key: "days_count", label: "days_count" },
  { key: "avg_cbm", label: "avg_cbm" },
  { key: "rate_cbm", label: "rate_cbm" },
  { key: "amount_cbm", label: "amount_cbm" },
  { key: "warnings", label: "warnings" },
  { key: "amount_total", label: "amount_total" },
] satisfies CsvColumn<Record<string, unknown>>[];

export function StorageBillingPage() {
  const { t } = useI18n();
  const { toastError, toastSuccess } = useDashboardToast();
  const { demoMode, ready: demoReady, toggleDemoMode } = useDemoMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const captureRef = useRef<HTMLDivElement | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

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
  const hasExplicitFilterQuery = useMemo(() => {
    return ["month", "warehouseId", "clientId", "rateCbm", "ratePallet"].some((key) => !!searchParams.get(key));
  }, [searchParams]);

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
  const [skuLoading, setSkuLoading] = useState(false);
  const [skuError, setSkuError] = useState<string | null>(null);
  const [skuData, setSkuData] = useState<StorageBillingSkuResponse | null>(null);

  const buildFilters = useCallback(
    (next?: Partial<BillingFilters>) => ({
      month: next?.month ?? month,
      warehouseId: next?.warehouseId ?? warehouseId,
      clientId: next?.clientId ?? clientId,
      rateCbm: next?.rateCbm ?? rateCbm,
      ratePallet: next?.ratePallet ?? ratePallet,
    }),
    [clientId, month, rateCbm, ratePallet, warehouseId]
  );

  const getValidationError = useCallback((filters: BillingFilters) => {
    if (!normalizeMonth(filters.month)) return "month must use YYYY-MM format.";
    if (filters.warehouseId && !normalizeInt(filters.warehouseId)) return "warehouseId must be a positive integer.";
    if (filters.clientId && !normalizeInt(filters.clientId)) return "clientId must be a positive integer.";
    if (!isNonNegativeNumber(filters.rateCbm)) return "rateCbm must be a number >= 0.";
    if (!isNonNegativeNumber(filters.ratePallet)) return "ratePallet must be a number >= 0.";
    return null;
  }, []);

  const validationError = useMemo(() => {
    return getValidationError(buildFilters());
  }, [buildFilters, getValidationError]);

  const loadWithFilters = useCallback(async (filters: BillingFilters) => {
    const normalizedMonth = normalizeMonth(filters.month);
    if (!normalizedMonth) return;
    setLoading(true);
    setError(null);
    setSkuError(null);
    try {
      const result = await getStorageBillingPreview({
        month: normalizedMonth,
        warehouseId: filters.warehouseId ? Number(normalizeInt(filters.warehouseId)) : undefined,
        clientId: filters.clientId ? Number(normalizeInt(filters.clientId)) : undefined,
        rateCbm: filters.rateCbm ? Number(filters.rateCbm) : undefined,
        ratePallet: filters.ratePallet ? Number(filters.ratePallet) : undefined,
      });
      setData(result);

      const whId = filters.warehouseId ? Number(normalizeInt(filters.warehouseId)) : undefined;
      const clId = filters.clientId ? Number(normalizeInt(filters.clientId)) : undefined;
      if (whId && clId) {
        setSkuLoading(true);
        try {
          const skuResult = await getStorageBillingSkuPreview({
            month: normalizedMonth,
            warehouseId: whId,
            clientId: clId,
            rateCbm: filters.rateCbm ? Number(filters.rateCbm) : undefined,
          });
          setSkuData(skuResult);
        } catch (skuLoadError) {
          const message = skuLoadError instanceof Error ? skuLoadError.message : "Failed to load SKU billing preview.";
          setSkuError(message);
          setSkuData(null);
        } finally {
          setSkuLoading(false);
        }
      } else {
        setSkuData(null);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load billing preview.";
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  const load = useCallback(async () => {
    const filters = buildFilters();
    if (getValidationError(filters)) return;
    await loadWithFilters(filters);
  }, [buildFilters, getValidationError, loadWithFilters]);

  useEffect(() => {
    if (!demoReady || bootstrapped) return;
    if (demoMode && !hasExplicitFilterQuery) {
      const preset = {
        month: thisMonth(),
        warehouseId: "",
        clientId: "",
        rateCbm: "",
        ratePallet: "",
      };
      setMonth(preset.month);
      setWarehouseId("");
      setClientId("");
      setRateCbm("");
      setRatePallet("");
      writeFiltersToUrl(router, pathname, preset);
      void loadWithFilters(preset);
      setBootstrapped(true);
      return;
    }
    void load();
    setBootstrapped(true);
  }, [bootstrapped, demoMode, demoReady, hasExplicitFilterQuery, load, loadWithFilters, pathname, router]);

  const tableRows = useMemo(() => {
    if (!data?.lines?.length) return [];
    const keyword = search.trim().toLowerCase();
    const filtered = keyword
      ? data.lines.filter((row) => {
          const warehouseText = String(row.warehouse_id).toLowerCase();
          const warehouseName = String(row.warehouse_name ?? "").toLowerCase();
          const clientText = String(row.client_id).toLowerCase();
          const clientName = String(row.client_name ?? "").toLowerCase();
          return (
            warehouseText.includes(keyword) ||
            warehouseName.includes(keyword) ||
            clientText.includes(keyword) ||
            clientName.includes(keyword)
          );
        })
      : data.lines;

    return [...filtered].sort((a, b) => {
      return compareNumber(a[sortKey], b[sortKey], sortDirection);
    });
  }, [data?.lines, search, sortDirection, sortKey]);

  const reset = () => {
    const next = {
      month: defaultFilters.month,
      warehouseId: defaultFilters.warehouseId,
      clientId: defaultFilters.clientId,
      rateCbm: defaultFilters.rateCbm,
      ratePallet: defaultFilters.ratePallet,
    };
    setMonth(next.month);
    setWarehouseId(next.warehouseId);
    setClientId(next.clientId);
    setRateCbm(next.rateCbm);
    setRatePallet(next.ratePallet);
    setSearch("");
    writeFiltersToUrl(router, pathname, {});
    void loadWithFilters(next);
  };

  const applyFilters = () => {
    const next = buildFilters();
    if (getValidationError(next)) return;
    const normalizedMonth = normalizeMonth(next.month);
    const normalizedWarehouse = normalizeInt(next.warehouseId);
    const normalizedClient = normalizeInt(next.clientId);
    setMonth(normalizedMonth);
    setWarehouseId(normalizedWarehouse);
    setClientId(normalizedClient);
    writeFiltersToUrl(router, pathname, {
      month: normalizedMonth,
      rateCbm: next.rateCbm,
      ratePallet: next.ratePallet,
      warehouseId: normalizedWarehouse,
      clientId: normalizedClient,
    });
    void loadWithFilters({
      month: normalizedMonth,
      warehouseId: normalizedWarehouse,
      clientId: normalizedClient,
      rateCbm: next.rateCbm,
      ratePallet: next.ratePallet,
    });
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
      toastSuccess("Copied JSON");
    } catch {
      toastError("Copy failed");
    }
  };

  const exportCsv = () => {
    const rows = tableRows.map((row) => ({
      warehouse_id: safeNumber(row.warehouse_id),
      warehouse_name: String(row.warehouse_name ?? ""),
      client_id: safeNumber(row.client_id),
      client_name: String(row.client_name ?? ""),
      sku_count: safeNumber(row.sku_count ?? 0),
      days_count: safeNumber(row.days_count),
      avg_cbm: safeNumber(row.avg_cbm),
      rate_cbm: safeNumber(row.rate_cbm ?? 0),
      amount_cbm: safeNumber(row.amount_cbm),
      warnings: (row.warning_messages ?? []).join("; "),
      amount_total: safeNumber(row.amount_total),
    }));
    const csv = toCsv(rows, billingColumns);
    downloadCsv(`storage-billing-${month}.csv`, csv);
    toastSuccess("CSV downloaded");
  };

  const copyTable = async () => {
    if (!tableRows.length) return;
    try {
      const rows = tableRows.map((row) => ({
        warehouse_id: safeNumber(row.warehouse_id),
        warehouse_name: String(row.warehouse_name ?? ""),
        client_id: safeNumber(row.client_id),
        client_name: String(row.client_name ?? ""),
        sku_count: safeNumber(row.sku_count ?? 0),
        days_count: safeNumber(row.days_count),
        avg_cbm: safeNumber(row.avg_cbm),
        rate_cbm: safeNumber(row.rate_cbm ?? 0),
        amount_cbm: safeNumber(row.amount_cbm),
        warnings: (row.warning_messages ?? []).join("; "),
        amount_total: safeNumber(row.amount_total),
      }));
      await copyToClipboard(toTsv(rows, billingColumns));
      toastSuccess("Copied to clipboard");
    } catch {
      toastError("Copy failed");
    }
  };

  const savePng = async () => {
    if (!captureRef.current) return;
    try {
      await captureElementToPng(captureRef.current, `billing_${month || thisMonth()}.png`);
      toastSuccess("PNG saved");
    } catch {
      toastError("PNG save failed");
    }
  };

  const applyThisMonthPreset = () => {
    const next = {
      month: thisMonth(),
      warehouseId,
      clientId,
      rateCbm,
      ratePallet,
    };
    setMonth(next.month);
    writeFiltersToUrl(router, pathname, next);
    void loadWithFilters(next);
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: t("nav.dashboard"), href: "/dashboard" }, { label: t("billing.title") }]}
        title={t("billing.title")}
        description={t("billing.desc")}
        actions={
          <div className="flex flex-wrap gap-2">
            {demoReady ? <DemoModeToggle demoMode={demoMode} onToggle={toggleDemoMode} /> : null}
            {demoMode ? <GenerateSnapshotsButton /> : null}
            <Button type="button" variant="secondary" onClick={() => void savePng()} disabled={loading}>
              <ImageDown className="h-4 w-4" />
              {t("common.savePng")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void copyJson()} disabled={!data}>
              <Copy className="h-4 w-4" />
              {t("common.copyJson")}
            </Button>
          </div>
        }
      />
      <DashboardTabs />
      {demoReady ? <DemoModeBanner demoMode={demoMode} /> : null}

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
        <Button type="button" variant="secondary" onClick={applyThisMonthPreset} disabled={loading}>
          {t("billing.thisMonth")}
        </Button>
      </FilterBar>

      {error && (
        <div className="mb-4">
          <ErrorState title={t("Failed to load billing preview")} message={error} onRetry={() => void load()} />
        </div>
      )}

      {loading ? <CardsSkeleton count={3} /> : null}
      {!loading && (
        <div ref={captureRef} className="mb-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
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
          {(data?.alerts?.insufficient_snapshot_days_count || data?.alerts?.missing_cbm_scope_count) ? (
            <Card>
              <CardHeader>
                <CardTitle>Warnings</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(data?.alerts?.insufficient_snapshot_days_count ?? 0) > 0 ? (
                  <Badge variant="warning">{`${t("insufficient snapshot days")}: ${data?.alerts?.insufficient_snapshot_days_count}`}</Badge>
                ) : null}
                {(data?.alerts?.missing_cbm_scope_count ?? 0) > 0 ? (
                  <Badge variant="warning">{`missing CBM values: ${data?.alerts?.missing_cbm_scope_count}`}</Badge>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Billing Lines</CardTitle>
              <p className="text-sm text-slate-500">{t("Monthly line-item preview by warehouse and client.")}</p>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Billing Lines</CardTitle>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Input
              placeholder="Search warehouse/client (id or name)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:w-64"
            />
            <Button type="button" variant="secondary" onClick={exportCsv} disabled={!tableRows.length}>
              <Download className="h-4 w-4" />
              {t("common.downloadCsv")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void copyTable()} disabled={!tableRows.length}>
              <Copy className="h-4 w-4" />
              {t("common.copyTable")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} cols={8} />
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
            <StickyTableContainer>
              <Table className={stickyTableClass}>
                <TableHeader>
                  <TableRow>
                    <TableHead className={`${stickyHeaderClass} ${stickyLeftClass} ${stickyIntersectionClass} left-0 w-56`}>
                      warehouse
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} ${stickyLeftClass} ${stickyIntersectionClass} left-[14rem] w-56`}>
                      client
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
                      sku_count
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("days_count")}>
                        days_count
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("avg_cbm")}>
                        avg_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("rate_cbm")}>
                        rate_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("amount_cbm")}>
                        amount_cbm
                        <ArrowDownUp className="h-3.5 w-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className={`${stickyHeaderClass}`}>warnings</TableHead>
                    <TableHead className={`${stickyHeaderClass} text-right`}>
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
                      <TableCell className={`${stickyLeftClass} left-0 w-56`}>
                        <div className="leading-tight">
                          <div className="font-medium">{row.warehouse_name ?? "-"}</div>
                          <div className="text-xs text-slate-500">ID {row.warehouse_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className={`${stickyLeftClass} left-[14rem] w-56`}>
                        <div className="leading-tight">
                          <div className="font-medium">{row.client_name ?? "-"}</div>
                          <div className="text-xs text-slate-500">ID {row.client_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{Number(row.sku_count ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <span>{safeNumber(row.days_count).toLocaleString()}</span>
                          {row.days_count < 20 ? <Badge variant="warning">{t("insufficient snapshot days")}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCbm(row.avg_cbm)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.rate_cbm ?? 0)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.amount_cbm)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(row.warning_messages ?? []).map((message) => (
                            <Badge key={`${row.warehouse_id}-${row.client_id}-${message}`} variant="warning">{message}</Badge>
                          ))}
                          {(row.warning_messages ?? []).length === 0 ? "-" : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(row.amount_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </StickyTableContainer>
          )}
        </CardContent>
      </Card>

      {(warehouseId && clientId) ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>SKU CBM Billing Preview</CardTitle>
            <p className="text-sm text-slate-500">
              warehouse {warehouseId} / client {clientId} 기준 SKU별 CBM 금액입니다.
            </p>
          </CardHeader>
          <CardContent>
            {skuError ? (
              <ErrorState title="Failed to load SKU billing preview" message={skuError} onRetry={() => void load()} />
            ) : skuLoading ? (
              <TableSkeleton rows={5} cols={7} />
            ) : !skuData || skuData.lines.length === 0 ? (
              <EmptyState title="No SKU billing rows" description="해당 조건에 재고가 없습니다." />
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  <span className="mr-4">warehouse: {skuData.warehouse_name ?? `ID ${skuData.warehouse_id}`}</span>
                  <span className="mr-4">client: {skuData.client_name ?? `ID ${skuData.client_id}`}</span>
                  <span className="mr-4">rate_cbm: {formatMoney(skuData.rate_cbm)}</span>
                  <span className="mr-4">sku: {Number(skuData.summary.total_sku_count ?? skuData.lines.length).toLocaleString()}</span>
                  <span className="mr-4">qty: {Number(skuData.summary.total_available_qty).toLocaleString()}</span>
                  <span>amount: {formatMoney(skuData.summary.total_amount_cbm)}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>product_id</TableHead>
                        <TableHead>sku_code</TableHead>
                        <TableHead>product_name</TableHead>
                        <TableHead className="text-right">available_qty</TableHead>
                        <TableHead className="text-right">cbm_m3</TableHead>
                        <TableHead className="text-right">rate_cbm</TableHead>
                        <TableHead className="text-right">amount_cbm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skuData.lines.map((row) => (
                        <TableRow key={row.product_id}>
                          <TableCell>{row.product_id}</TableCell>
                          <TableCell>{row.sku_code ?? "-"}</TableCell>
                          <TableCell>{row.product_name ?? "-"}</TableCell>
                          <TableCell className="text-right">{Number(row.available_qty).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCbm(row.cbm_m3)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.rate_cbm)}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.amount_cbm)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}



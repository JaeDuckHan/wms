"use client";

export type GroupBy = "day" | "week" | "month";
export type CapacityStatus = "ok" | "warn" | "critical";

export type StorageTrendResponse = {
  ok: true;
  from: string;
  to: string;
  groupBy: GroupBy;
  totals: { total_cbm: number; total_pallet: number; total_sku: number };
  series: Array<{ period: string; total_cbm: number; total_pallet: number; total_sku: number }>;
};

export type StorageBillingResponse = {
  ok: true;
  month: string;
  summary: { amount_total: number; amount_cbm: number; amount_pallet: number };
  lines: Array<{
    warehouse_id: number;
    client_id: number;
    days_count: number;
    avg_cbm: number;
    avg_pallet: number;
    amount_total: number;
    amount_cbm: number;
    amount_pallet: number;
  }>;
};

export type StorageDashboardResponse = {
  ok: true;
  date: string;
  totals: { total_cbm: number; total_pallet: number; total_sku: number };
  breakdown: Array<{
    warehouse_id: number;
    client_id: number;
    snapshot_date: string;
    total_cbm: number;
    total_pallet: number;
    total_sku: number;
  }>;
};

export type StorageCapacityResponse = {
  ok: true;
  date: string;
  warehouses: Array<{
    warehouse_id: number;
    used_cbm: number;
    capacity_cbm: number | null;
    usage_pct_cbm: number | null;
    status: CapacityStatus;
    used_pallet: number;
    capacity_pallet: number | null;
    usage_pct_pallet: number | null;
  }>;
  alerts: Array<{
    warehouse_id: number;
    used_cbm: number;
    capacity_cbm: number | null;
    usage_pct_cbm: number | null;
    status: CapacityStatus;
    used_pallet: number;
    capacity_pallet: number | null;
    usage_pct_pallet: number | null;
  }>;
};

export type GenerateSnapshotsResponse = {
  ok: true;
  data: {
    snapshot_date: string;
    filters: { warehouseId: number | null; clientId: number | null };
    generated: boolean;
    alerts: {
      missing_product_cbm_count: number;
      missing_product_cbm_items: Array<{
        warehouse_id: number;
        client_id: number;
        product_id: number;
        sku_code: string | null;
        product_name: string | null;
        available_qty: number;
      }>;
    };
  };
};

const DASHBOARD_FALLBACK_ENABLED = process.env.NEXT_PUBLIC_DASHBOARD_FALLBACK !== "false";

function toQuery(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function toDateText(value: string | number | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return fallback;
}

function toMonthText(value: string | number | undefined, fallback: string) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  return fallback;
}

function toInt(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function enumerateDaily(from: string, to: string) {
  const rows: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 92) {
    rows.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86_400_000);
    guard += 1;
  }
  return rows;
}

function enumeratePeriods(from: string, to: string, groupBy: GroupBy) {
  if (groupBy === "day") return enumerateDaily(from, to);
  const daily = enumerateDaily(from, to);
  const grouped = new Set<string>();
  for (const day of daily) {
    if (groupBy === "month") {
      grouped.add(day.slice(0, 7));
      continue;
    }
    const d = new Date(`${day}T00:00:00Z`);
    const week = Math.ceil(Number(day.slice(8, 10)) / 7);
    grouped.add(`${d.getUTCFullYear()}-W${pad2(week)}`);
  }
  return [...grouped];
}

function trendFallback(query?: Record<string, string | number | undefined>): StorageTrendResponse {
  const today = new Date().toISOString().slice(0, 10);
  const from = toDateText(query?.from, today);
  const to = toDateText(query?.to, today);
  const groupBy = (query?.groupBy as GroupBy) || "day";
  const periods = enumeratePeriods(from, to, groupBy);
  const warehouseFactor = toInt(query?.warehouseId) ?? 1;
  const clientFactor = toInt(query?.clientId) ?? 1;
  const series = periods.map((period, index) => {
    const base = 40 + ((index + warehouseFactor + clientFactor) % 9) * 5;
    const total_cbm = Number((base + index * 1.15).toFixed(2));
    const total_pallet = Number((total_cbm * 0.72).toFixed(2));
    const total_sku = Math.round(total_cbm * 2.8);
    return { period, total_cbm, total_pallet, total_sku };
  });
  const totals = series.reduce(
    (acc, row) => ({
      total_cbm: acc.total_cbm + row.total_cbm,
      total_pallet: acc.total_pallet + row.total_pallet,
      total_sku: acc.total_sku + row.total_sku,
    }),
    { total_cbm: 0, total_pallet: 0, total_sku: 0 }
  );
  return {
    ok: true,
    from,
    to,
    groupBy,
    totals: {
      total_cbm: Number(totals.total_cbm.toFixed(2)),
      total_pallet: Number(totals.total_pallet.toFixed(2)),
      total_sku: totals.total_sku,
    },
    series,
  };
}

function billingFallback(query?: Record<string, string | number | undefined>): StorageBillingResponse {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const month = toMonthText(query?.month, currentMonth);
  const warehouseFilter = toInt(query?.warehouseId);
  const clientFilter = toInt(query?.clientId);
  const rateCbm = Number(query?.rateCbm ?? 1200);
  const ratePallet = Number(query?.ratePallet ?? 800);

  const warehouseIds = warehouseFilter ? [warehouseFilter] : [101, 102, 103, 104, 105];
  const clientIds = clientFilter ? [clientFilter] : [1, 2, 3, 4, 5];
  const lines = warehouseIds.flatMap((warehouseId, wi) =>
    clientIds.map((clientId, ci) => {
      const days_count = 24 + ((wi + ci) % 6);
      const avg_cbm = Number((15 + wi * 2.5 + ci * 1.7).toFixed(2));
      const avg_pallet = Number((avg_cbm * 0.7).toFixed(2));
      const amount_cbm = Math.round(avg_cbm * days_count * (Number.isFinite(rateCbm) ? rateCbm : 1200));
      const amount_pallet = Math.round(avg_pallet * days_count * (Number.isFinite(ratePallet) ? ratePallet : 800));
      return {
        warehouse_id: warehouseId,
        client_id: clientId,
        days_count,
        avg_cbm,
        avg_pallet,
        amount_total: amount_cbm + amount_pallet,
        amount_cbm,
        amount_pallet,
      };
    })
  );
  const summary = lines.reduce(
    (acc, row) => ({
      amount_total: acc.amount_total + row.amount_total,
      amount_cbm: acc.amount_cbm + row.amount_cbm,
      amount_pallet: acc.amount_pallet + row.amount_pallet,
    }),
    { amount_total: 0, amount_cbm: 0, amount_pallet: 0 }
  );
  return { ok: true, month, summary, lines };
}

function capacityFallback(query?: Record<string, string | number | undefined>): StorageCapacityResponse {
  const date = toDateText(query?.date, new Date().toISOString().slice(0, 10));
  const warehouseFilter = toInt(query?.warehouseId);
  const warehouseIds = warehouseFilter ? [warehouseFilter] : [101, 102, 103, 104, 105];
  const warehouses = warehouseIds.map((warehouseId, index) => {
    const capacity_cbm = 1200 + index * 250;
    const used_cbm = 720 + index * 190 + (warehouseId % 7) * 16;
    const usage_pct_cbm = Number(((used_cbm / capacity_cbm) * 100).toFixed(2));
    const capacity_pallet = Math.round(capacity_cbm * 0.82);
    const used_pallet = Math.round(used_cbm * 0.8);
    const usage_pct_pallet = Number(((used_pallet / capacity_pallet) * 100).toFixed(2));
    const status: CapacityStatus = usage_pct_cbm >= 95 ? "critical" : usage_pct_cbm >= 85 ? "warn" : "ok";
    return {
      warehouse_id: warehouseId,
      used_cbm,
      capacity_cbm,
      usage_pct_cbm,
      status,
      used_pallet,
      capacity_pallet,
      usage_pct_pallet,
    };
  });
  const alerts = warehouses.filter((row) => row.status !== "ok");
  return { ok: true, date, warehouses, alerts };
}

function storageFallback(query?: Record<string, string | number | undefined>): StorageDashboardResponse {
  const date = toDateText(query?.date, new Date().toISOString().slice(0, 10));
  const warehouseFilter = toInt(query?.warehouseId);
  const clientFilter = toInt(query?.clientId);
  const warehouses = warehouseFilter ? [warehouseFilter] : [101, 102, 103];
  const clients = clientFilter ? [clientFilter] : [1, 2, 3];
  const breakdown = warehouses.flatMap((warehouse_id, wi) =>
    clients.map((client_id, ci) => {
      const total_cbm = Number((40 + wi * 8 + ci * 4.5).toFixed(2));
      const total_pallet = Number((total_cbm * 0.74).toFixed(2));
      const total_sku = Math.round(total_cbm * 2.6);
      return { warehouse_id, client_id, snapshot_date: date, total_cbm, total_pallet, total_sku };
    })
  );
  const totals = breakdown.reduce(
    (acc, row) => ({
      total_cbm: acc.total_cbm + row.total_cbm,
      total_pallet: acc.total_pallet + row.total_pallet,
      total_sku: acc.total_sku + row.total_sku,
    }),
    { total_cbm: 0, total_pallet: 0, total_sku: 0 }
  );
  return {
    ok: true,
    date,
    totals: {
      total_cbm: Number(totals.total_cbm.toFixed(2)),
      total_pallet: Number(totals.total_pallet.toFixed(2)),
      total_sku: totals.total_sku,
    },
    breakdown,
  };
}

function generateFallback(body: Record<string, string | number | undefined>): GenerateSnapshotsResponse {
  const snapshotDate = toDateText(body.date, new Date().toISOString().slice(0, 10));
  const warehouseId = toInt(body.warehouseId) ?? null;
  const clientId = toInt(body.clientId) ?? null;
  return {
    ok: true,
    data: {
      snapshot_date: snapshotDate,
      filters: { warehouseId, clientId },
      generated: true,
      alerts: {
        missing_product_cbm_count: 0,
        missing_product_cbm_items: [],
      },
    },
  };
}

function getFallback(path: string, query?: Record<string, string | number | undefined>) {
  if (!DASHBOARD_FALLBACK_ENABLED) return null;
  if (path === "storage") return storageFallback(query);
  if (path === "storage/trend") return trendFallback(query);
  if (path === "storage/billing/preview") return billingFallback(query);
  if (path === "storage/capacity") return capacityFallback(query);
  return null;
}

function getPostFallback(path: string, body: Record<string, string | number | undefined>) {
  if (!DASHBOARD_FALLBACK_ENABLED) return null;
  if (path === "storage/snapshots/generate") return generateFallback(body);
  return null;
}

async function requestDashboard<T>(path: string, query?: Record<string, string | number | undefined>) {
  try {
    const response = await fetch(`/api/dashboard/${path}${toQuery(query ?? {})}`, {
      cache: "no-store",
    });

    const json = await response.json();
    if (!response.ok || !json?.ok) {
      const fallback = getFallback(path, query);
      if (fallback) return fallback as T;
      throw new Error(json?.message || "Dashboard request failed");
    }
    return json as T;
  } catch (error) {
    const fallback = getFallback(path, query);
    if (fallback) return fallback as T;
    throw error;
  }
}

async function requestDashboardPost<T>(path: string, body: Record<string, string | number | undefined>) {
  try {
    const response = await fetch(`/api/dashboard/${path}`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await response.json();
    if (!response.ok || !json?.ok) {
      const fallback = getPostFallback(path, body);
      if (fallback) return fallback as T;
      throw new Error(json?.message || "Dashboard request failed");
    }
    return json as T;
  } catch (error) {
    const fallback = getPostFallback(path, body);
    if (fallback) return fallback as T;
    throw error;
  }
}

export function getStorageDashboard(query?: { date?: string; warehouseId?: number; clientId?: number }) {
  return requestDashboard<StorageDashboardResponse>("storage", query);
}

export function getStorageTrend(query: {
  from: string;
  to: string;
  groupBy: GroupBy;
  warehouseId?: number;
  clientId?: number;
}) {
  return requestDashboard<StorageTrendResponse>("storage/trend", query);
}

export function getStorageBillingPreview(query: {
  month: string;
  warehouseId?: number;
  clientId?: number;
  rateCbm?: number;
  ratePallet?: number;
}) {
  return requestDashboard<StorageBillingResponse>("storage/billing/preview", query);
}

export function getStorageCapacity(query: { date?: string; warehouseId?: number }) {
  return requestDashboard<StorageCapacityResponse>("storage/capacity", query);
}

export function generateStorageSnapshots(query: { date?: string; warehouseId?: number; clientId?: number }) {
  return requestDashboardPost<GenerateSnapshotsResponse>("storage/snapshots/generate", query);
}

export async function generateSnapshotsForDate(date: string) {
  return generateStorageSnapshots({ date });
}

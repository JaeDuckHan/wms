import { ApiError } from "@/features/outbound/api";
import type { InventoryQuery, StockBalanceRow, StockTransactionRow } from "@/features/inventory/types";
import { shouldUseImplicitFallback, shouldUseMockMode } from "@/lib/runtime-mode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";

type RequestOptions = { token?: string };
type AuthRequestOptions = RequestOptions & { allowAnonymous?: boolean };

function isBrowserRequest() {
  return typeof window !== "undefined";
}

type JsonResponse<T> = { ok: boolean; data?: T; message?: string };

type RawClient = { id: number; name_kr: string };
type RawProduct = { id: number; name_kr: string };
type RawLot = { id: number; lot_no: string };
type RawWarehouse = { id: number; code?: string | null; warehouse_code?: string | null; name?: string | null };
type RawWarehouseLocation = { id: number; location_code?: string | null; zone?: string | null };

type RawBalance = {
  id: number;
  client_id: number;
  product_id: number;
  lot_id: number;
  warehouse_id: number;
  location_id: number | null;
  available_qty: number;
  reserved_qty: number;
};

type RawTxn = {
  id: number;
  client_id: number;
  product_id: number;
  lot_id: number;
  warehouse_id: number;
  location_id: number | null;
  txn_type: string;
  txn_date: string;
  qty_in: number;
  qty_out: number;
  ref_type: string | null;
  ref_id: number | null;
  note: string | null;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

const mockBalances: StockBalanceRow[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const availableQty = 30 + seq * 3;
  const reservedQty = seq % 6;
  const allocatableQty = availableQty - reservedQty;
  const reservationRatePct = availableQty > 0 ? Math.round((reservedQty / availableQty) * 100) : 0;
  return {
    id: `mb-${seq}`,
    client: `Sample Client ${pad2(((seq - 1) % 20) + 1)}`,
    product: `Sample Product ${pad2(((seq - 1) % 20) + 1)}`,
    lot: `LOT-26${pad2(((seq - 1) % 12) + 1)}-${String.fromCharCode(65 + (seq % 3))}`,
    warehouse: `WH-${pad2(((seq - 1) % 20) + 1)}`,
    location: `LOC-${String(100 + seq)}`,
    available_qty: availableQty,
    reserved_qty: reservedQty,
    allocatable_qty: allocatableQty,
    reservation_rate_pct: reservationRatePct,
    reservation_status: toReservationStatus(reservationRatePct),
  };
});

const transactionTypes = ["inbound_receive", "outbound_ship", "return_restock", "return_dispose"] as const;

const mockTransactions: StockTransactionRow[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const txnType = transactionTypes[index % transactionTypes.length];
  const qtyIn = txnType === "inbound_receive" || txnType === "return_restock" ? 10 + seq : 0;
  const qtyOut = txnType === "outbound_ship" || txnType === "return_dispose" ? 6 + seq : 0;
  return {
    id: `mt-${seq}`,
    txn_date: `2026-02-${pad2((seq % 28) + 1)} ${pad2(8 + (seq % 10))}:20`,
    txn_type: txnType,
    client: `Sample Client ${pad2(((seq - 1) % 20) + 1)}`,
    product: `Sample Product ${pad2(((seq - 1) % 20) + 1)}`,
    lot: `LOT-26${pad2(((seq - 1) % 12) + 1)}-${String.fromCharCode(65 + (seq % 3))}`,
    warehouse: `WH-${pad2(((seq - 1) % 20) + 1)}`,
    location: `LOC-${String(200 + seq)}`,
    qty_in: qtyIn,
    qty_out: qtyOut,
    current_stock_qty: 30 + seq,
    ref: txnType === "outbound_ship"
      ? `outbound:${5000 + seq}`
      : txnType.startsWith("return_")
        ? `return:${4000 + seq}`
        : `inbound:${3000 + seq}`,
    note: `Inventory sample txn #${pad2(seq)}`,
  };
});

async function resolveToken(input?: string): Promise<string | undefined> {
  if (input) return input;
  return undefined;
}

async function requestJson<T>(path: string, init?: RequestInit, options?: AuthRequestOptions): Promise<T> {
  const browser = isBrowserRequest();
  const token = await resolveToken(options?.token);
  if (!browser && !token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = browser ? `/api/proxy${path}` : `${API_BASE_URL}${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(!browser && token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json()) as JsonResponse<T>;
  if (!response.ok || !json.ok) throw new ApiError(json.message ?? "Request failed", response.status);
  if (json.data === undefined) throw new ApiError("Missing response data", response.status);
  return json.data;
}

function includesQ(...values: Array<string | number | null | undefined>) {
  return (q?: string) => {
    const query = q?.trim().toLowerCase();
    if (!query) return true;
    return values.some((value) => String(value ?? "").toLowerCase().includes(query));
  };
}

function toReservationStatus(ratePct: number): StockBalanceRow["reservation_status"] {
  if (ratePct >= 100) return "full";
  if (ratePct >= 70) return "high";
  if (ratePct >= 30) return "medium";
  return "low";
}

function formatWarehouseLabel(warehouse?: RawWarehouse): string {
  if (!warehouse) return "";
  const code = (warehouse.code ?? warehouse.warehouse_code ?? "").trim();
  const name = (warehouse.name ?? "").trim();
  if (code && name) return `${code} | ${name}`;
  return code || name;
}

function formatLocationLabel(location?: RawWarehouseLocation): string {
  if (!location) return "";
  const code = (location.location_code ?? "").trim();
  const zone = (location.zone ?? "").trim();
  if (code && zone) return `${code} | ${zone}`;
  return code || zone;
}

function shouldUseFallback(token?: string) {
  return shouldUseImplicitFallback(token);
}

export async function getStockBalances(query?: InventoryQuery, options?: RequestOptions): Promise<StockBalanceRow[]> {
  if (shouldUseMockMode()) {
    return mockBalances.filter((row) =>
      includesQ(row.client, row.product, row.lot, row.warehouse, row.location)(query?.q)
    );
  }
  const token = await resolveToken(options?.token);
  try {
    const [balances, clients, products, lots, warehouses, locations] = await Promise.all([
      requestJson<RawBalance[]>("/stock-balances", undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawProduct[]>("/products", undefined, options),
      requestJson<RawLot[]>("/product-lots", undefined, options),
      requestJson<RawWarehouse[]>("/warehouses", undefined, options),
      requestJson<RawWarehouseLocation[]>("/warehouse-locations", undefined, options),
    ]);

    const clientMap = new Map(clients.map((item) => [item.id, item.name_kr]));
    const productMap = new Map(products.map((item) => [item.id, item.name_kr]));
    const lotMap = new Map(lots.map((item) => [item.id, item.lot_no]));
    const warehouseMap = new Map(warehouses.map((item) => [item.id, formatWarehouseLabel(item)]));
    const locationMap = new Map(locations.map((item) => [item.id, formatLocationLabel(item)]));

    const mapped = balances.map((row) => {
      const availableQty = Number(row.available_qty);
      const reservedQty = Number(row.reserved_qty);
      const reservationRatePct = availableQty > 0 ? Math.round((reservedQty / availableQty) * 100) : 0;
      return {
        id: String(row.id),
        client: clientMap.get(row.client_id) ?? `Client #${row.client_id}`,
        product: productMap.get(row.product_id) ?? `Product #${row.product_id}`,
        lot: lotMap.get(row.lot_id) ?? `LOT-${row.lot_id}`,
        warehouse: warehouseMap.get(row.warehouse_id) || `WH-${row.warehouse_id}`,
        location: row.location_id ? locationMap.get(row.location_id) || `LOC-${row.location_id}` : "-",
        available_qty: availableQty,
        reserved_qty: reservedQty,
        allocatable_qty: Math.max(0, availableQty - reservedQty),
        reservation_rate_pct: reservationRatePct,
        reservation_status: toReservationStatus(reservationRatePct),
      };
    });
    const filtered = mapped.filter((row) =>
      includesQ(row.client, row.product, row.lot, row.warehouse, row.location)(query?.q)
    );
    if (filtered.length === 0 && shouldUseFallback(token)) {
      return mockBalances.filter((row) =>
        includesQ(row.client, row.product, row.lot, row.warehouse, row.location)(query?.q)
      );
    }
    return filtered;
  } catch (error) {
    if (shouldUseFallback(token)) {
      return mockBalances.filter((row) =>
        includesQ(row.client, row.product, row.lot, row.warehouse, row.location)(query?.q)
      );
    }
    throw error;
  }
}

export async function getStockTransactions(
  query?: InventoryQuery,
  options?: RequestOptions
): Promise<StockTransactionRow[]> {
  if (shouldUseMockMode()) {
    const fallbackRows =
      query?.txn_type && query.txn_type.length > 0
        ? mockTransactions.filter((row) => row.txn_type === query.txn_type)
        : mockTransactions;
    return fallbackRows.filter((row) =>
      includesQ(row.txn_type, row.client, row.product, row.lot, row.ref, row.note)(query?.q)
    );
  }
  const token = await resolveToken(options?.token);
  const params = new URLSearchParams();
  if (query?.txn_type) params.set("txn_type", query.txn_type);
  const path = `/stock-transactions${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const [txns, clients, products, lots, warehouses, locations, balances] = await Promise.all([
      requestJson<RawTxn[]>(path, undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawProduct[]>("/products", undefined, options),
      requestJson<RawLot[]>("/product-lots", undefined, options),
      requestJson<RawWarehouse[]>("/warehouses", undefined, options),
      requestJson<RawWarehouseLocation[]>("/warehouse-locations", undefined, options),
      requestJson<RawBalance[]>("/stock-balances", undefined, options),
    ]);

    const clientMap = new Map(clients.map((item) => [item.id, item.name_kr]));
    const productMap = new Map(products.map((item) => [item.id, item.name_kr]));
    const lotMap = new Map(lots.map((item) => [item.id, item.lot_no]));
    const warehouseMap = new Map(warehouses.map((item) => [item.id, formatWarehouseLabel(item)]));
    const locationMap = new Map(locations.map((item) => [item.id, formatLocationLabel(item)]));
    const balanceByExactKey = new Map(
      balances.map((row) => [
        `${row.client_id}:${row.product_id}:${row.lot_id}:${row.warehouse_id}:${row.location_id ?? 0}`,
        Number(row.available_qty),
      ])
    );
    const balanceByProductLot = balances.reduce<Map<string, number>>((map, row) => {
      const key = `${row.client_id}:${row.product_id}:${row.lot_id}`;
      map.set(key, (map.get(key) ?? 0) + Number(row.available_qty || 0));
      return map;
    }, new Map());

    const mapped = txns.map((row) => ({
      id: String(row.id),
      txn_date: row.txn_date?.slice(0, 16).replace("T", " ") ?? "-",
      txn_type: row.txn_type,
      client: clientMap.get(row.client_id) ?? `Client #${row.client_id}`,
      product: productMap.get(row.product_id) ?? `Product #${row.product_id}`,
      lot: lotMap.get(row.lot_id) ?? `LOT-${row.lot_id}`,
      warehouse: warehouseMap.get(row.warehouse_id) || `WH-${row.warehouse_id}`,
      location: row.location_id ? locationMap.get(row.location_id) || `LOC-${row.location_id}` : "-",
      qty_in: Number(row.qty_in),
      qty_out: Number(row.qty_out),
      current_stock_qty:
        balanceByExactKey.get(`${row.client_id}:${row.product_id}:${row.lot_id}:${row.warehouse_id}:${row.location_id ?? 0}`) ??
        balanceByProductLot.get(`${row.client_id}:${row.product_id}:${row.lot_id}`) ??
        0,
      ref: row.ref_type && row.ref_id ? `${row.ref_type}:${row.ref_id}` : "-",
      note: row.note ?? "-",
    }));
    const filtered = mapped.filter((row) =>
      includesQ(row.txn_type, row.client, row.product, row.lot, row.ref, row.note)(query?.q)
    );
    if (filtered.length === 0 && shouldUseFallback(token)) {
      const fallbackRows =
        query?.txn_type && query.txn_type.length > 0
          ? mockTransactions.filter((row) => row.txn_type === query.txn_type)
          : mockTransactions;
      return fallbackRows.filter((row) =>
        includesQ(row.txn_type, row.client, row.product, row.lot, row.ref, row.note)(query?.q)
      );
    }
    return filtered;
  } catch (error) {
    if (shouldUseFallback(token)) {
      const fallbackRows =
        query?.txn_type && query.txn_type.length > 0
          ? mockTransactions.filter((row) => row.txn_type === query.txn_type)
          : mockTransactions;
      return fallbackRows.filter((row) =>
        includesQ(row.txn_type, row.client, row.product, row.lot, row.ref, row.note)(query?.q)
      );
    }
    throw error;
  }
}

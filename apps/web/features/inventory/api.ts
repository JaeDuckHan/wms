import { ApiError } from "@/features/outbound/api";
import type { InventoryQuery, StockBalanceRow, StockTransactionRow } from "@/features/inventory/types";
import { AUTH_COOKIE_KEY } from "@/lib/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
const ENABLE_DEV_FALLBACK = process.env.NODE_ENV !== "production";

type RequestOptions = { token?: string };
type AuthRequestOptions = RequestOptions & { allowAnonymous?: boolean };

type JsonResponse<T> = { ok: boolean; data?: T; message?: string };

type RawClient = { id: number; name_kr: string };
type RawProduct = { id: number; name_kr: string };
type RawLot = { id: number; lot_no: string };

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
  return {
    id: `mb-${seq}`,
    client: `Sample Client ${pad2(((seq - 1) % 20) + 1)}`,
    product: `Sample Product ${pad2(((seq - 1) % 20) + 1)}`,
    lot: `LOT-26${pad2(((seq - 1) % 12) + 1)}-${String.fromCharCode(65 + (seq % 3))}`,
    warehouse: `WH-${pad2(((seq - 1) % 20) + 1)}`,
    location: `LOC-${String(100 + seq)}`,
    available_qty: 30 + seq * 3,
    reserved_qty: seq % 6,
  };
});

const transactionTypes = ["inbound_receive", "outbound_ship", "return_receive"] as const;

const mockTransactions: StockTransactionRow[] = Array.from({ length: 20 }, (_, index) => {
  const seq = index + 1;
  const txnType = transactionTypes[index % transactionTypes.length];
  const qtyIn = txnType !== "outbound_ship" ? 10 + seq : 0;
  const qtyOut = txnType === "outbound_ship" ? 6 + seq : 0;
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
    ref: txnType === "outbound_ship" ? `outbound:${5000 + seq}` : `inbound:${3000 + seq}`,
    note: `Inventory sample txn #${pad2(seq)}`,
  };
});

async function resolveToken(input?: string): Promise<string | undefined> {
  if (input) return input;
  if (typeof window !== "undefined") {
    const tokenCookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_KEY}=`));
    return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : undefined;
  }
  return undefined;
}

async function requestJson<T>(path: string, init?: RequestInit, options?: AuthRequestOptions): Promise<T> {
  const token = await resolveToken(options?.token);
  if (!token && !options?.allowAnonymous) throw new ApiError("Missing auth token", 401);

  const endpoint = typeof window === "undefined" ? `${API_BASE_URL}${path}` : `/api/proxy${path}`;
  const response = await fetch(endpoint, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

function shouldUseFallback(token?: string) {
  return USE_MOCK || ENABLE_DEV_FALLBACK || token === "mock-token";
}

export async function getStockBalances(query?: InventoryQuery, options?: RequestOptions): Promise<StockBalanceRow[]> {
  const token = await resolveToken(options?.token);
  try {
    const [balances, clients, products, lots] = await Promise.all([
      requestJson<RawBalance[]>("/stock-balances", undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawProduct[]>("/products", undefined, options),
      requestJson<RawLot[]>("/product-lots", undefined, options),
    ]);

    const clientMap = new Map(clients.map((item) => [item.id, item.name_kr]));
    const productMap = new Map(products.map((item) => [item.id, item.name_kr]));
    const lotMap = new Map(lots.map((item) => [item.id, item.lot_no]));

    const mapped = balances.map((row) => ({
      id: String(row.id),
      client: clientMap.get(row.client_id) ?? `Client #${row.client_id}`,
      product: productMap.get(row.product_id) ?? `Product #${row.product_id}`,
      lot: lotMap.get(row.lot_id) ?? `LOT-${row.lot_id}`,
      warehouse: `WH-${row.warehouse_id}`,
      location: row.location_id ? `LOC-${row.location_id}` : "-",
      available_qty: Number(row.available_qty),
      reserved_qty: Number(row.reserved_qty),
    }));
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
  const token = await resolveToken(options?.token);
  const params = new URLSearchParams();
  if (query?.txn_type) params.set("txn_type", query.txn_type);
  const path = `/stock-transactions${params.toString() ? `?${params.toString()}` : ""}`;

  try {
    const [txns, clients, products, lots] = await Promise.all([
      requestJson<RawTxn[]>(path, undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawProduct[]>("/products", undefined, options),
      requestJson<RawLot[]>("/product-lots", undefined, options),
    ]);

    const clientMap = new Map(clients.map((item) => [item.id, item.name_kr]));
    const productMap = new Map(products.map((item) => [item.id, item.name_kr]));
    const lotMap = new Map(lots.map((item) => [item.id, item.lot_no]));

    const mapped = txns.map((row) => ({
      id: String(row.id),
      txn_date: row.txn_date?.slice(0, 16).replace("T", " ") ?? "-",
      txn_type: row.txn_type,
      client: clientMap.get(row.client_id) ?? `Client #${row.client_id}`,
      product: productMap.get(row.product_id) ?? `Product #${row.product_id}`,
      lot: lotMap.get(row.lot_id) ?? `LOT-${row.lot_id}`,
      warehouse: `WH-${row.warehouse_id}`,
      location: row.location_id ? `LOC-${row.location_id}` : "-",
      qty_in: Number(row.qty_in),
      qty_out: Number(row.qty_out),
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

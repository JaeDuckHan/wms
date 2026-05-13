import { getInboundByNo, inboundOrdersMock } from "@/features/inbound/mock";
import type {
  InboundAction,
  InboundItem,
  InboundListQuery,
  InboundOrder,
  InboundStatus,
  InboundTimeline,
} from "@/features/inbound/types";
import { ApiError } from "@/features/outbound/api";
import { shouldUseImplicitFallback, shouldUseMockMode } from "@/lib/runtime-mode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const LATENCY_MS = 120;

type RequestOptions = { token?: string };
type AuthRequestOptions = RequestOptions & { allowAnonymous?: boolean };

function isBrowserRequest() {
  return typeof window !== "undefined";
}

type RawInboundOrder = {
  id: number;
  inbound_no: string;
  client_id: number;
  warehouse_id: number;
  inbound_date: string;
  status: InboundStatus;
  memo: string | null;
  created_by: number;
  received_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawInboundItem = {
  id: number;
  inbound_order_id: number;
  product_id: number;
  lot_id: number;
  location_id: number | null;
  qty: number;
  invoice_price: number | null;
  currency: "KRW" | "THB" | "USD" | null;
  remark: string | null;
};

type RawInboundLog = {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  actor_user_id: number | null;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
};

type RawClient = { id: number; client_code?: string; name_kr?: string; name_en?: string };
type RawProduct = { id: number; barcode_full: string; name_kr: string };
type RawLot = { id: number; lot_no: string };
type RawWarehouseLocation = { id: number; location_code: string; zone: string | null };
type JsonResponse<T> = { ok: boolean; data?: T; message?: string };

export type CreateInboundItemInput = {
  product_id: number;
  lot_id: number;
  location_id?: number | null;
  qty: number;
  invoice_price?: number | null;
  currency?: "KRW" | "THB" | "USD" | null;
  remark?: string | null;
};

export type CreateInboundOrderInput = {
  inbound_no: string;
  client_id: number;
  warehouse_id: number;
  inbound_date: string;
  status?: InboundStatus;
  memo?: string | null;
  created_by: number;
  items?: CreateInboundItemInput[];
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldUseFallback(token?: string) {
  return shouldUseImplicitFallback(token);
}

function toDateOnly(value: string | null | undefined): string {
  const fallback = formatDateInAppZone(new Date());
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const hasExplicitTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (!hasExplicitTimeZone) {
    const matched = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) return matched[1];
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return formatDateInAppZone(parsed);
}

function formatDateInAppZone(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function toIsoDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function resolveToken(input?: string): Promise<string | undefined> {
  if (input) return input;
  return undefined;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  options?: AuthRequestOptions
): Promise<T> {
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

function cloneOrder(order: InboundOrder): InboundOrder {
  return JSON.parse(JSON.stringify(order)) as InboundOrder;
}

function applyListFilter(orders: InboundOrder[], query?: InboundListQuery): InboundOrder[] {
  const q = query?.q?.trim().toLowerCase();
  const status = query?.status ?? "all";
  return orders.filter((order) => {
    const matchStatus = status === "all" ? true : order.status === status;
    const matchText =
      !q ||
      order.inbound_no.toLowerCase().includes(q) ||
      order.client.toLowerCase().includes(q) ||
      order.summary.toLowerCase().includes(q);
    return matchStatus && matchText;
  });
}

function mapMockActionStatus(action: InboundAction): InboundStatus {
  if (action === "submit") return "submitted";
  if (action === "arrive") return "arrived";
  return "received";
}

function buildTimeline(order: RawInboundOrder): InboundTimeline[] {
  const timeline: InboundTimeline[] = [
    {
      id: `itl-created-${order.id}`,
      type: "created",
      title: "Inbound Created",
      at: order.created_at.slice(0, 16).replace("T", " "),
      actor: `user-${order.created_by}`,
    },
  ];

  if (["submitted", "arrived", "qc_hold", "received"].includes(order.status)) {
    timeline.push({
      id: `itl-submitted-${order.id}`,
      type: "submitted",
      title: "Inbound Submitted",
      at: order.updated_at.slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }
  if (["arrived", "qc_hold", "received"].includes(order.status)) {
    timeline.push({
      id: `itl-arrived-${order.id}`,
      type: "arrived",
      title: "Goods Arrived",
      at: order.updated_at.slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }
  if (order.received_at || order.status === "received") {
    timeline.push({
      id: `itl-received-${order.id}`,
      type: "received",
      title: "Receiving Completed",
      at: (order.received_at ?? order.updated_at).slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }
  return timeline;
}

function formatTimelineAt(value: string | null | undefined): string {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

function mapInboundLogType(log: RawInboundLog): InboundTimeline["type"] {
  if (log.action === "submit") return "submitted";
  if (log.action === "arrive") return "arrived";
  if (log.action === "receive") return "received";
  if (log.action === "cancel") return "cancelled";
  if (log.action === "create") return "created";
  return "updated";
}

function mapInboundLogTitle(log: RawInboundLog): string {
  if (log.action === "submit") return "Inbound Submitted";
  if (log.action === "arrive") return "Goods Arrived";
  if (log.action === "receive") return "Receiving Completed";
  if (log.action === "cancel") return "Inbound Cancelled";
  if (log.action === "create") return "Inbound Created";
  if (log.action === "status_change") return "Status Changed";
  if (log.action === "delete") return "Inbound Deleted";
  return "Inbound Updated";
}

function mapInboundLogs(logs: RawInboundLog[]): InboundTimeline[] {
  return logs.map((log) => ({
    id: `itl-log-${log.id}`,
    type: mapInboundLogType(log),
    title: mapInboundLogTitle(log),
    at: formatTimelineAt(log.created_at),
    actor: log.actor_name ?? log.actor_email ?? (log.actor_user_id ? `user-${log.actor_user_id}` : "system"),
    note:
      log.note ??
      (log.from_status && log.to_status && log.from_status !== log.to_status
        ? `${log.from_status} -> ${log.to_status}`
        : undefined),
  }));
}

function mapInboundOrder(
  order: RawInboundOrder,
  clientName: string,
  items: InboundItem[],
  timeline?: InboundTimeline[],
  summary?: { itemCount: number; totalQty: number }
): InboundOrder {
  const itemCount = summary?.itemCount ?? items.length;
  const totalQty = summary?.totalQty ?? items.reduce((acc, item) => acc + item.qty, 0);
  return {
    id: String(order.id),
    inbound_no: order.inbound_no,
    client: clientName || `Client #${order.client_id}`,
    inbound_date: toDateOnly(order.inbound_date),
    status: order.status,
    memo: order.memo ?? "-",
    warehouse: `Warehouse #${order.warehouse_id}`,
    summary: `${itemCount} SKUs / ${totalQty} EA`,
    items,
    timeline: timeline && timeline.length > 0 ? timeline : buildTimeline(order),
  };
}

function summarizeRawItems(items: RawInboundItem[]): { itemCount: number; totalQty: number } {
  return {
    itemCount: items.length,
    totalQty: items.reduce((acc, item) => acc + Number(item.qty || 0), 0),
  };
}

function groupRawItemsByOrderId(items: RawInboundItem[]): Map<number, RawInboundItem[]> {
  const grouped = new Map<number, RawInboundItem[]>();
  for (const item of items) {
    const current = grouped.get(item.inbound_order_id) ?? [];
    current.push(item);
    grouped.set(item.inbound_order_id, current);
  }
  return grouped;
}

function formatClientLabel(client?: RawClient): string {
  if (!client) return "";
  const code = (client.client_code ?? "").trim();
  const name = (client.name_kr ?? client.name_en ?? "").trim();
  if (code && name) return `${code} | ${name}`;
  return name || code;
}

function formatLocationLabel(location?: RawWarehouseLocation): string {
  if (!location) return "";
  return location.zone ? `${location.location_code} | ${location.zone}` : location.location_code;
}

function mapItems(
  rawItems: RawInboundItem[],
  products: RawProduct[],
  lots: RawLot[],
  locations: RawWarehouseLocation[]
): InboundItem[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
  const locationMap = new Map(locations.map((location) => [location.id, formatLocationLabel(location)]));
  return rawItems.map((item) => ({
    id: String(item.id),
    barcode_full: productMap.get(item.product_id)?.barcode_full ?? `P-${item.product_id}`,
    product_name: productMap.get(item.product_id)?.name_kr ?? `Product #${item.product_id}`,
    lot: lotMap.get(item.lot_id)?.lot_no ?? `LOT-${item.lot_id}`,
    location: item.location_id ? locationMap.get(item.location_id) ?? `LOC-${item.location_id}` : "-",
    qty: Number(item.qty),
    invoice_price: item.invoice_price === null ? null : Number(item.invoice_price),
    currency: item.currency,
    remark: item.remark,
  }));
}

const mockDb: InboundOrder[] = inboundOrdersMock.map((order) => cloneOrder(order));

export async function getInboundOrders(query?: InboundListQuery, options?: RequestOptions): Promise<InboundOrder[]> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    return applyListFilter(mockDb, query).map((order) => cloneOrder(order));
  }
  const token = await resolveToken(options?.token);
  try {
    const [orders, clients, rawItems] = await Promise.all([
      requestJson<RawInboundOrder[]>("/inbound-orders", undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawInboundItem[]>("/inbound-items", undefined, options),
    ]);
    const clientMap = new Map(clients.map((client) => [client.id, formatClientLabel(client)]));
    const itemsByOrderId = groupRawItemsByOrderId(rawItems);
    const mapped = orders.map((order) => {
      const orderItems = itemsByOrderId.get(order.id) ?? [];
      return mapInboundOrder(order, clientMap.get(order.client_id) ?? "", [], undefined, summarizeRawItems(orderItems));
    });
    if (mapped.length === 0 && shouldUseFallback(token)) {
      return applyListFilter(mockDb, query).map((order) => cloneOrder(order));
    }
    return applyListFilter(mapped, query);
  } catch (error) {
    if (shouldUseFallback(token)) {
      return applyListFilter(mockDb, query).map((order) => cloneOrder(order));
    }
    throw error;
  }
}

export async function getInboundOrderByNo(inboundNo: string, options?: RequestOptions): Promise<InboundOrder | null> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const order = mockDb.find((item) => item.inbound_no === inboundNo) ?? getInboundByNo(inboundNo);
    return order ? cloneOrder(order) : null;
  }
  const token = await resolveToken(options?.token);
  try {
    const rawOrders = await requestJson<RawInboundOrder[]>("/inbound-orders", undefined, options);
    const rawOrder = rawOrders.find((order) => order.inbound_no === inboundNo);
    if (!rawOrder) {
      if (shouldUseFallback(token)) {
        const fallbackOrder = mockDb.find((item) => item.inbound_no === inboundNo) ?? getInboundByNo(inboundNo);
        return fallbackOrder ? cloneOrder(fallbackOrder) : null;
      }
      return null;
    }
    const [clients, rawItems, products, lots, locations] = await Promise.all([
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawInboundItem[]>(`/inbound-items?inbound_order_id=${rawOrder.id}`, undefined, options),
      requestJson<RawProduct[]>("/products", undefined, options),
      requestJson<RawLot[]>("/product-lots", undefined, options),
      requestJson<RawWarehouseLocation[]>("/warehouse-locations", undefined, options),
    ]);
    let rawLogs: RawInboundLog[] = [];
    try {
      rawLogs = await requestJson<RawInboundLog[]>(`/inbound-orders/${rawOrder.id}/logs`, undefined, options);
    } catch (error) {
      // Some deployments may not have runtime log tables yet.
      if (!(error instanceof ApiError)) throw error;
      rawLogs = [];
    }
    const clientName = formatClientLabel(clients.find((client) => client.id === rawOrder.client_id));
    const items = mapItems(rawItems, products, lots, locations);
    return mapInboundOrder(rawOrder, clientName, items, mapInboundLogs(rawLogs));
  } catch (error) {
    if (shouldUseFallback(token)) {
      const fallbackOrder = mockDb.find((item) => item.inbound_no === inboundNo) ?? getInboundByNo(inboundNo);
      return fallbackOrder ? cloneOrder(fallbackOrder) : null;
    }
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function transitionInboundStatus(
  inboundNo: string,
  action: InboundAction,
  options?: RequestOptions
): Promise<InboundOrder> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const idx = mockDb.findIndex((item) => item.inbound_no === inboundNo);
    if (idx < 0) throw new ApiError("Inbound order not found", 404);
    const current = mockDb[idx];
    const updated: InboundOrder = {
      ...current,
      status: mapMockActionStatus(action),
      timeline: [
        ...current.timeline,
        {
          id: `ITL-${Date.now()}`,
          type: action === "submit" ? "submitted" : action === "arrive" ? "arrived" : "received",
          title: `${action.toUpperCase()} completed`,
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          actor: "admin.demo",
        },
      ],
    };
    mockDb[idx] = updated;
    return cloneOrder(updated);
  }

  const current = await (async () => {
    const rawOrders = await requestJson<RawInboundOrder[]>("/inbound-orders", undefined, options);
    const found = rawOrders.find((order) => order.inbound_no === inboundNo);
    if (!found) throw new ApiError("Inbound order not found", 404);
    return found;
  })();
  const nextStatus: InboundStatus =
    action === "submit" ? "submitted" : action === "arrive" ? "arrived" : "received";
  const nowIso = new Date().toISOString();

  await requestJson<RawInboundOrder>(
    `/inbound-orders/${current.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        inbound_no: current.inbound_no,
        client_id: current.client_id,
        warehouse_id: current.warehouse_id,
        inbound_date: toDateOnly(current.inbound_date),
        status: nextStatus,
        memo: current.memo,
        created_by: current.created_by,
        received_at: action === "receive" ? nowIso : toIsoDateTime(current.received_at),
      }),
    },
    options
  );

  const updated = await getInboundOrderByNo(current.inbound_no, options);
  if (!updated) throw new ApiError("Inbound order not found", 404);
  return updated;
}

export async function createInboundOrderWithItems(
  input: CreateInboundOrderInput,
  options?: RequestOptions
): Promise<InboundOrder> {
  const items = input.items ?? [];

  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const now = new Date().toISOString();
    const rawOrder: RawInboundOrder = {
      id: Date.now(),
      inbound_no: input.inbound_no,
      client_id: input.client_id,
      warehouse_id: input.warehouse_id,
      inbound_date: input.inbound_date,
      status: input.status ?? "draft",
      memo: input.memo ?? null,
      created_by: input.created_by,
      received_at: null,
      created_at: now,
      updated_at: now,
    };
    const mappedItems: InboundItem[] = items.map((item, index) => ({
      id: `mock-inbound-item-${Date.now()}-${index}`,
      barcode_full: `P-${item.product_id}`,
      product_name: `Product #${item.product_id}`,
      lot: `LOT-${item.lot_id}`,
      location: item.location_id ? `LOC-${item.location_id}` : "-",
      qty: item.qty,
      invoice_price: item.invoice_price ?? null,
      currency: item.currency ?? null,
      remark: item.remark ?? null,
    }));
    const created = mapInboundOrder(rawOrder, `Client #${input.client_id}`, mappedItems);
    mockDb.unshift(created);
    return cloneOrder(created);
  }

  const created = await requestJson<RawInboundOrder>(
    "/inbound-orders",
    {
      method: "POST",
      body: JSON.stringify({
        inbound_no: input.inbound_no,
        client_id: input.client_id,
        warehouse_id: input.warehouse_id,
        inbound_date: input.inbound_date,
        status: input.status ?? "draft",
        memo: input.memo ?? null,
        created_by: input.created_by,
        received_at: null,
      }),
    },
    options
  );

  for (const item of items) {
    await requestJson<RawInboundItem>(
      "/inbound-items",
      {
        method: "POST",
        body: JSON.stringify({
          inbound_order_id: created.id,
          product_id: item.product_id,
          lot_id: item.lot_id,
          location_id: item.location_id ?? null,
          qty: item.qty,
          invoice_price: item.invoice_price ?? null,
          currency: item.currency ?? null,
          remark: item.remark ?? null,
        }),
      },
      options
    );
  }

  const reloaded = await getInboundOrderByNo(created.inbound_no, options);
  return reloaded ?? mapInboundOrder(created, "", []);
}

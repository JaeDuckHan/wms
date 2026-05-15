import { getOutboundByNo, outboundOrdersMock } from "@/features/outbounds/mock";
import type {
  OutboundAction,
  OutboundBox,
  OutboundItem,
  OutboundListQuery,
  OutboundOrder,
  OutboundStatus,
  OutboundTimeline,
} from "@/features/outbound/types";
import { shouldUseImplicitFallback, shouldUseMockMode } from "@/lib/runtime-mode";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3100";
const LATENCY_MS = 120;

type RequestOptions = {
  token?: string;
};

type AuthRequestOptions = RequestOptions & {
  allowAnonymous?: boolean;
};

function isBrowserRequest() {
  return typeof window !== "undefined";
}

type RawOutboundOrder = {
  id: number;
  outbound_no: string;
  client_id: number;
  warehouse_id: number;
  order_date: string;
  sales_channel: string | null;
  order_no: string | null;
  tracking_no: string | null;
  status: OutboundStatus;
  packed_at: string | null;
  shipped_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

type RawOutboundItem = {
  id: number;
  outbound_order_id: number;
  product_id: number;
  lot_id: number;
  location_id: number | null;
  qty: number;
  box_type: string | null;
  box_count: number;
  remark: string | null;
  created_at: string;
  updated_at: string;
};

type RawClient = {
  id: number;
  name_kr: string;
};

type RawProduct = {
  id: number;
  barcode_full: string;
  name_kr: string;
};

type RawLot = {
  id: number;
  lot_no: string;
};

type RawWarehouseLocation = {
  id: number;
  location_code: string;
  zone: string | null;
};

type RawStockBalance = {
  product_id: number;
  lot_id: number;
  location_id: number | null;
  available_qty: number;
  reserved_qty?: number;
};

type RawOutboundBox = {
  id: number;
  outbound_order_id: number;
  box_no: string;
  courier: string | null;
  tracking_no: string | null;
  item_count: number;
  status: "open" | "packed" | "shipped";
  created_at: string;
  updated_at: string;
};

type RawOutboundLog = {
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

type RawAllocationSuggestion = {
  outbound_item_id: number;
  product_id: number;
  requested_qty: number;
  network_allocatable_qty: number;
  shortage_qty: number;
  suggested_strategy: "current" | "reallocate" | "shortage";
  allocation_plan: Array<{
    product_id: number;
    lot_id: number;
    lot_no: string;
    location_id: number | null;
    location_code: string;
    allocatable_qty: number;
    suggested_qty: number;
    expiry_date: string | null;
    mfg_date: string | null;
  }>;
};

type JsonResponse<T> = {
  ok: boolean;
  data?: T;
  message?: string;
};

export type CreateOutboundItemInput = {
  product_id: number;
  lot_id: number;
  location_id?: number | null;
  qty: number;
  box_type?: string | null;
  box_count?: number;
  remark?: string | null;
};

export type CreateOutboundOrderInput = {
  outbound_no: string;
  client_id: number;
  warehouse_id: number;
  order_date: string;
  sales_channel?: string | null;
  order_no?: string | null;
  tracking_no?: string | null;
  status?: OutboundStatus;
  created_by: number;
  items?: CreateOutboundItemInput[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

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
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
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
  if (!browser && !token && !options?.allowAnonymous) {
    throw new ApiError("Missing auth token", 401);
  }

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
  if (!response.ok || !json.ok) {
    throw new ApiError(json.message ?? "Request failed", response.status);
  }

  if (json.data === undefined) {
    throw new ApiError("Missing response data", response.status);
  }

  return json.data;
}

async function requestVoid(
  path: string,
  init?: RequestInit,
  options?: AuthRequestOptions
): Promise<void> {
  const browser = isBrowserRequest();
  const token = await resolveToken(options?.token);
  if (!browser && !token && !options?.allowAnonymous) {
    throw new ApiError("Missing auth token", 401);
  }

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

  const json = (await response.json()) as JsonResponse<unknown>;
  if (!response.ok || !json.ok) {
    throw new ApiError(json.message ?? "Request failed", response.status);
  }
}

async function requestJsonOrDefault<T>(
  path: string,
  fallback: T,
  options?: AuthRequestOptions
): Promise<T> {
  try {
    return await requestJson<T>(path, undefined, options);
  } catch {
    return fallback;
  }
}

function cloneOrder(order: OutboundOrder): OutboundOrder {
  return JSON.parse(JSON.stringify(order)) as OutboundOrder;
}

function applyListFilter(orders: OutboundOrder[], query?: OutboundListQuery): OutboundOrder[] {
  const q = query?.q?.trim().toLowerCase();
  const status = query?.status ?? "all";
  return orders.filter((order) => {
    const matchStatus = status === "all" ? true : order.status === status;
    const matchText =
      !q ||
      order.outbound_no.toLowerCase().includes(q) ||
      order.client.toLowerCase().includes(q) ||
      order.summary.toLowerCase().includes(q);
    return matchStatus && matchText;
  });
}

function mapMockActionStatus(action: OutboundAction): OutboundStatus {
  if (action === "allocate") return "allocated";
  if (action === "pack") return "packed";
  return "shipped";
}

function buildTimeline(order: RawOutboundOrder): OutboundTimeline[] {
  const timeline: OutboundTimeline[] = [
    {
      id: `tl-created-${order.id}`,
      type: "created",
      title: "Order Created",
      at: order.created_at.slice(0, 16).replace("T", " "),
      actor: `user-${order.created_by}`,
    },
  ];

  if (["allocated", "picking", "packing", "packed", "shipped", "delivered"].includes(order.status)) {
    timeline.push({
      id: `tl-allocated-${order.id}`,
      type: "allocated",
      title: "Stock Allocated",
      at: order.updated_at.slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }

  if (order.packed_at || ["packed", "shipped", "delivered"].includes(order.status)) {
    timeline.push({
      id: `tl-packed-${order.id}`,
      type: "packed",
      title: "Packing Completed",
      at: (order.packed_at ?? order.updated_at).slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }

  if (order.shipped_at || ["shipped", "delivered"].includes(order.status)) {
    timeline.push({
      id: `tl-shipped-${order.id}`,
      type: "shipped",
      title: "Shipment Completed",
      at: (order.shipped_at ?? order.updated_at).slice(0, 16).replace("T", " "),
      actor: "system",
    });
  }

  return timeline;
}

function formatTimelineAt(value: string | null | undefined): string {
  if (!value) return "-";
  return value.slice(0, 16).replace("T", " ");
}

function mapOutboundLogType(log: RawOutboundLog): OutboundTimeline["type"] {
  if (log.action === "allocate") return "allocated";
  if (log.action === "pack") return "packed";
  if (log.action === "ship") return "shipped";
  if (log.action === "cancel") return "cancelled";
  if (log.action === "create") return "created";
  return "updated";
}

function mapOutboundLogTitle(log: RawOutboundLog): string {
  if (log.action === "allocate") return "Stock Allocated";
  if (log.action === "pack") return "Packing Completed";
  if (log.action === "ship") return "Shipment Completed";
  if (log.action === "cancel") return "Outbound Cancelled";
  if (log.action === "create") return "Order Created";
  if (log.action === "status_change") return "Status Changed";
  if (log.action === "delete") return "Outbound Deleted";
  return "Outbound Updated";
}

function mapOutboundLogs(logs: RawOutboundLog[]): OutboundTimeline[] {
  return logs.map((log) => ({
    id: `tl-log-${log.id}`,
    type: mapOutboundLogType(log),
    title: mapOutboundLogTitle(log),
    at: formatTimelineAt(log.created_at),
    actor: log.actor_name ?? log.actor_email ?? (log.actor_user_id ? `user-${log.actor_user_id}` : "system"),
    note:
      log.note ??
      (log.from_status && log.to_status && log.from_status !== log.to_status
        ? `${log.from_status} -> ${log.to_status}`
        : undefined),
  }));
}

function mapOrderSummary(order: RawOutboundOrder, itemCount: number, totalQty: number): string {
  return `${itemCount} SKUs / ${totalQty} EA`;
}

function mapOutboundOrder(
  order: RawOutboundOrder,
  clientName: string,
  items: OutboundItem[],
  boxes: OutboundBox[],
  boxesSupported = true,
  timeline?: OutboundTimeline[],
  summary?: { itemCount: number; totalQty: number }
): OutboundOrder {
  const itemCount = summary?.itemCount ?? items.length;
  const totalQty = summary?.totalQty ?? items.reduce((acc, item) => acc + item.requested_qty, 0);
  return {
    id: String(order.outbound_no),
    outbound_no: order.outbound_no,
    order_no: order.order_no ?? "",
    tracking_no: order.tracking_no ?? "",
    client: clientName || `Client #${order.client_id}`,
    eta_date: toDateOnly(order.order_date),
    status: order.status,
    memo: order.sales_channel ?? "N/A",
    ship_to: `Warehouse #${order.warehouse_id}`,
    summary: mapOrderSummary(order, itemCount, totalQty),
    items,
    boxes,
    boxes_supported: boxesSupported,
    timeline: timeline && timeline.length > 0 ? timeline : buildTimeline(order),
  };
}

function summarizeRawItems(items: RawOutboundItem[]): { itemCount: number; totalQty: number } {
  return {
    itemCount: items.length,
    totalQty: items.reduce((acc, item) => acc + Number(item.qty || 0), 0),
  };
}

function groupRawItemsByOrderId(items: RawOutboundItem[]): Map<number, RawOutboundItem[]> {
  const grouped = new Map<number, RawOutboundItem[]>();
  for (const item of items) {
    const current = grouped.get(item.outbound_order_id) ?? [];
    current.push(item);
    grouped.set(item.outbound_order_id, current);
  }
  return grouped;
}

function mapBoxes(rawBoxes: RawOutboundBox[], trackingNo: string | null): OutboundBox[] {
  return rawBoxes.map((box) => ({
    id: String(box.id),
    box_no: box.box_no,
    courier: box.courier ?? "N/A",
    tracking_no: box.tracking_no ?? trackingNo ?? "-",
    item_count: Number(box.item_count),
  }));
}

function toKey(productId: number, lotId: number, locationId: number | null) {
  return `${productId}:${lotId}:${locationId ?? 0}`;
}

function toNetworkKey(productId: number, lotId: number) {
  return `${productId}:${lotId}`;
}

function formatLocationLabel(location?: RawWarehouseLocation): string {
  if (!location) return "";
  return location.zone ? `${location.location_code} | ${location.zone}` : location.location_code;
}

function mapItems(
  rawItems: RawOutboundItem[],
  products: RawProduct[],
  lots: RawLot[],
  locations: RawWarehouseLocation[],
  balances: RawStockBalance[],
  orderStatus: OutboundStatus,
  suggestions?: RawAllocationSuggestion[]
): OutboundItem[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
  const locationMap = new Map(locations.map((location) => [location.id, formatLocationLabel(location)]));
  const balanceMap = new Map(
    balances.map((balance) => [
      toKey(balance.product_id, balance.lot_id, balance.location_id),
      {
        available_qty: Number(balance.available_qty),
        reserved_qty: Number(balance.reserved_qty || 0),
      },
    ])
  );
  const balanceGroups = new Map<
    string,
    Array<{
      location: string;
      allocatable_qty: number;
    }>
  >();

  for (const balance of balances) {
    const networkKey = toNetworkKey(balance.product_id, balance.lot_id);
    const existing = balanceGroups.get(networkKey) ?? [];
    const balanceLocation = balance.location_id ? locationMap.get(balance.location_id) ?? `LOC-${balance.location_id}` : "-";
    existing.push({
      location: balanceLocation,
      allocatable_qty: Math.max(0, Number(balance.available_qty) - Number(balance.reserved_qty || 0)),
    });
    balanceGroups.set(networkKey, existing);
  }

  const suggestionMap = new Map((suggestions ?? []).map((item) => [item.outbound_item_id, item]));

  return rawItems.map((item) => {
    const balance = balanceMap.get(toKey(item.product_id, item.lot_id, item.location_id)) ?? {
      available_qty: 0,
      reserved_qty: 0,
    };
    const itemLocation = item.location_id ? locationMap.get(item.location_id) ?? `LOC-${item.location_id}` : "-";
    const candidateAllocations = [...(balanceGroups.get(toNetworkKey(item.product_id, item.lot_id)) ?? [])].sort((a, b) => {
      if (a.location === itemLocation) return -1;
      if (b.location === itemLocation) return 1;
      return b.allocatable_qty - a.allocatable_qty;
    });
    const available = balance.available_qty;
    const reserved = balance.reserved_qty;
    const allocatable = Math.max(0, available - reserved);
    const networkAllocatable = candidateAllocations.reduce((sum, candidate) => sum + candidate.allocatable_qty, 0);
    let remaining = Number(item.qty);
    const fallbackAllocationPlan = candidateAllocations
      .map((candidate) => {
        const suggestedQty = Math.min(remaining, candidate.allocatable_qty);
        remaining -= suggestedQty;
        return {
          lot: lotMap.get(item.lot_id)?.lot_no ?? `LOT-${item.lot_id}`,
          location: candidate.location,
          allocatable_qty: candidate.allocatable_qty,
          suggested_qty: suggestedQty,
        };
      })
      .filter((candidate) => candidate.suggested_qty > 0);
    const picked = ["packed", "shipped", "delivered"].includes(orderStatus) ? Number(item.qty) : 0;
    const requested = Number(item.qty);
    const suggestion = suggestionMap.get(item.id);
    const resolvedNetworkAllocatable = suggestion
      ? Number(suggestion.network_allocatable_qty)
      : networkAllocatable;
    const shortageQty = suggestion
      ? Number(suggestion.shortage_qty)
      : Math.max(requested - resolvedNetworkAllocatable, 0);
    const resolvedAllocationPlan = suggestion
      ? suggestion.allocation_plan.map((candidate) => ({
          lot: candidate.lot_no,
          location: candidate.location_code || "-",
          allocatable_qty: Number(candidate.allocatable_qty),
          suggested_qty: Number(candidate.suggested_qty),
        }))
      : fallbackAllocationPlan;
    const status =
      picked > 0
        ? "picked"
        : allocatable < requested
          ? resolvedNetworkAllocatable >= requested
            ? "reallocate"
            : "shortage"
          : "ready";
    return {
      id: String(item.id),
      product_id: item.product_id,
      lot_id: item.lot_id,
      location_id: item.location_id,
      barcode_full: productMap.get(item.product_id)?.barcode_full ?? `P-${item.product_id}`,
      product_name: productMap.get(item.product_id)?.name_kr ?? `Product #${item.product_id}`,
      lot: lotMap.get(item.lot_id)?.lot_no ?? `LOT-${item.lot_id}`,
      location: itemLocation,
      box_type: item.box_type,
      box_count: Number(item.box_count || 0),
      remark: item.remark,
      requested_qty: requested,
      picked_qty: picked,
      available_qty: available,
      reserved_qty: reserved,
      allocatable_qty: allocatable,
      network_allocatable_qty: resolvedNetworkAllocatable,
      shortage_qty: shortageQty,
      allocation_plan: resolvedAllocationPlan,
      status,
    };
  });
}

const mockDb: OutboundOrder[] = outboundOrdersMock.map((order) => cloneOrder(order));

export async function getOutboundOrders(query?: OutboundListQuery, options?: RequestOptions): Promise<OutboundOrder[]> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    return applyListFilter(mockDb, query).map((order) => cloneOrder(order));
  }
  const token = await resolveToken(options?.token);
  try {
    const [orders, clients, rawItems] = await Promise.all([
      requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options),
      requestJson<RawClient[]>("/clients", undefined, options),
      requestJson<RawOutboundItem[]>("/outbound-items", undefined, options),
    ]);
    const clientMap = new Map(clients.map((client) => [client.id, client.name_kr]));
    const itemsByOrderId = groupRawItemsByOrderId(rawItems);
    const mapped = orders.map((order) => {
      const orderItems = itemsByOrderId.get(order.id) ?? [];
      return mapOutboundOrder(order, clientMap.get(order.client_id) ?? "", [], [], true, undefined, summarizeRawItems(orderItems));
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

export async function getOutboundOrderByNo(outboundNo: string, options?: RequestOptions): Promise<OutboundOrder | null> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const order = mockDb.find((item) => item.outbound_no === outboundNo) ?? getOutboundByNo(outboundNo);
    return order ? cloneOrder(order) : null;
  }
  const token = await resolveToken(options?.token);

  try {
    const rawOrders = await requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options);
    const rawOrder = rawOrders.find((order) => order.outbound_no === outboundNo);
    if (!rawOrder) {
      if (shouldUseFallback(token)) {
        const fallbackOrder = mockDb.find((item) => item.outbound_no === outboundNo) ?? getOutboundByNo(outboundNo);
        return fallbackOrder ? cloneOrder(fallbackOrder) : null;
      }
      return null;
    }

    const [clients, rawItems, products, lots, locations, balances] = await Promise.all([
      requestJsonOrDefault<RawClient[]>("/clients", [], options),
      requestJsonOrDefault<RawOutboundItem[]>(`/outbound-items?outbound_order_id=${rawOrder.id}`, [], options),
      requestJsonOrDefault<RawProduct[]>("/products", [], options),
      requestJsonOrDefault<RawLot[]>("/product-lots", [], options),
      requestJsonOrDefault<RawWarehouseLocation[]>("/warehouse-locations", [], options),
      requestJsonOrDefault<RawStockBalance[]>(
        `/stock-balances?client_id=${rawOrder.client_id}&warehouse_id=${rawOrder.warehouse_id}`,
        [],
        options
      ),
    ]);
    const suggestions = await requestJsonOrDefault<RawAllocationSuggestion[]>(
      `/outbound-orders/${rawOrder.id}/allocation-suggestions`,
      [],
      options
    );
    let rawBoxes: RawOutboundBox[] = [];
    let boxesSupported = true;
    let rawLogs: RawOutboundLog[] = [];
    try {
      rawBoxes = await requestJson<RawOutboundBox[]>(`/outbound-orders/${rawOrder.id}/boxes`, undefined, options);
    } catch (error) {
      // Some backend deployments do not expose box routes yet.
      if (error instanceof ApiError && error.status === 404) {
        boxesSupported = false;
      } else {
        boxesSupported = false;
      }
    }
    rawLogs = await requestJsonOrDefault<RawOutboundLog[]>(`/outbound-orders/${rawOrder.id}/logs`, [], options);

    const items = mapItems(rawItems, products, lots, locations, balances, rawOrder.status, suggestions);
    const boxes = mapBoxes(rawBoxes, rawOrder.tracking_no);
    const clientName = clients.find((client) => client.id === rawOrder.client_id)?.name_kr ?? "";
    const timeline = mapOutboundLogs(rawLogs);

    return mapOutboundOrder(rawOrder, clientName, items, boxes, boxesSupported, timeline);
  } catch (error) {
    if (shouldUseFallback(token)) {
      const fallbackOrder = mockDb.find((item) => item.outbound_no === outboundNo) ?? getOutboundByNo(outboundNo);
      return fallbackOrder ? cloneOrder(fallbackOrder) : null;
    }
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function transitionOutboundStatus(
  outboundNo: string,
  action: OutboundAction,
  options?: RequestOptions
): Promise<OutboundOrder> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const idx = mockDb.findIndex((item) => item.outbound_no === outboundNo);
    if (idx < 0) throw new ApiError("Outbound order not found", 404);
    const current = mockDb[idx];
    const updated: OutboundOrder = {
      ...current,
      status: mapMockActionStatus(action),
      timeline: [
        ...current.timeline,
        {
          id: `TL-${Date.now()}`,
          type: action === "allocate" ? "allocated" : action === "pack" ? "packed" : "shipped",
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
    const rawOrders = await requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options);
    const found = rawOrders.find((order) => order.outbound_no === outboundNo);
    if (!found) throw new ApiError("Outbound order not found", 404);
    return found;
  })();
  const nextStatus: OutboundStatus =
    action === "allocate" ? "allocated" : action === "pack" ? "packed" : "shipped";
  const nowIso = new Date().toISOString();

  await requestJson<RawOutboundOrder>(
    `/outbound-orders/${current.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        outbound_no: current.outbound_no,
        client_id: current.client_id,
        warehouse_id: current.warehouse_id,
        order_date: toDateOnly(current.order_date),
        sales_channel: current.sales_channel,
        order_no: current.order_no,
        tracking_no: current.tracking_no,
        status: nextStatus,
        packed_at: action === "pack" ? nowIso : toIsoDateTime(current.packed_at),
        shipped_at: action === "ship" ? nowIso : toIsoDateTime(current.shipped_at),
        created_by: current.created_by,
      }),
    },
    options
  );

  const updated = await getOutboundOrderByNo(current.outbound_no, options);
  if (!updated) throw new ApiError("Outbound order not found", 404);
  return updated;
}

export type UpdateOutboundOrderInput = {
  order_date?: string;
  status?: OutboundStatus;
  sales_channel?: string | null;
  order_no?: string | null;
  tracking_no?: string | null;
};

function nextPackedAt(status: OutboundStatus, currentPackedAt: string | null) {
  if (["packed", "shipped", "delivered"].includes(status)) {
    return toIsoDateTime(currentPackedAt) ?? new Date().toISOString();
  }
  return null;
}

function nextShippedAt(status: OutboundStatus, currentShippedAt: string | null) {
  if (["shipped", "delivered"].includes(status)) {
    return toIsoDateTime(currentShippedAt) ?? new Date().toISOString();
  }
  return null;
}

export async function updateOutboundOrder(
  outboundNo: string,
  input: UpdateOutboundOrderInput,
  options?: RequestOptions
): Promise<OutboundOrder> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const idx = mockDb.findIndex((item) => item.outbound_no === outboundNo);
    if (idx < 0) throw new ApiError("Outbound order not found", 404);
    const current = mockDb[idx];
    const nextStatus = input.status ?? current.status;
    const updated: OutboundOrder = {
      ...current,
      eta_date: input.order_date ?? current.eta_date,
      order_no: input.order_no !== undefined ? input.order_no ?? "" : current.order_no,
      tracking_no: input.tracking_no !== undefined ? input.tracking_no ?? "" : current.tracking_no,
      status: nextStatus,
      memo: input.sales_channel !== undefined ? input.sales_channel ?? "N/A" : current.memo,
      timeline: [
        ...current.timeline,
        {
          id: `TL-${Date.now()}`,
          type: nextStatus === "cancelled" ? "cancelled" : "updated",
          title: nextStatus === "cancelled" ? "Outbound Cancelled" : "Outbound Updated",
          at: new Date().toISOString().slice(0, 16).replace("T", " "),
          actor: "admin.demo",
          note: current.status !== nextStatus ? `${current.status} -> ${nextStatus}` : "Outbound order updated",
        },
      ],
    };
    mockDb[idx] = updated;
    return cloneOrder(updated);
  }

  const current = await (async () => {
    const rawOrders = await requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options);
    const found = rawOrders.find((order) => order.outbound_no === outboundNo);
    if (!found) throw new ApiError("Outbound order not found", 404);
    return found;
  })();
  const nextStatus = input.status ?? current.status;

  await requestJson<RawOutboundOrder>(
    `/outbound-orders/${current.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        outbound_no: current.outbound_no,
        client_id: current.client_id,
        warehouse_id: current.warehouse_id,
        order_date: input.order_date ?? toDateOnly(current.order_date),
        sales_channel: input.sales_channel !== undefined ? input.sales_channel : current.sales_channel,
        order_no: input.order_no !== undefined ? input.order_no : current.order_no,
        tracking_no: input.tracking_no !== undefined ? input.tracking_no : current.tracking_no,
        status: nextStatus,
        packed_at: nextPackedAt(nextStatus, current.packed_at),
        shipped_at: nextShippedAt(nextStatus, current.shipped_at),
        created_by: current.created_by,
      }),
    },
    options
  );

  const updated = await getOutboundOrderByNo(current.outbound_no, options);
  if (!updated) throw new ApiError("Outbound order not found", 404);
  return updated;
}

export async function cancelOutboundOrder(outboundNo: string, options?: RequestOptions): Promise<OutboundOrder> {
  return updateOutboundOrder(outboundNo, { status: "cancelled" }, options);
}

export async function updateOutboundOrderDetails(
  outboundNo: string,
  input: Pick<UpdateOutboundOrderInput, "order_date" | "sales_channel" | "order_no" | "tracking_no">,
  options?: RequestOptions
): Promise<OutboundOrder> {
  return updateOutboundOrder(outboundNo, input, options);
}

export type UpdateOutboundItemInput = {
  product_id: number;
  lot_id: number;
  location_id?: number | null;
  qty: number;
  box_type?: string | null;
  box_count?: number;
  remark?: string | null;
};

export async function updateOutboundItem(
  outboundNo: string,
  itemId: string,
  input: UpdateOutboundItemInput,
  options?: RequestOptions
): Promise<OutboundOrder> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const orderIndex = mockDb.findIndex((item) => item.outbound_no === outboundNo);
    if (orderIndex < 0) throw new ApiError("Outbound order not found", 404);
    const current = mockDb[orderIndex];
    const updatedItems = current.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            product_id: input.product_id,
            lot_id: input.lot_id,
            location_id: input.location_id ?? null,
            requested_qty: input.qty,
            box_type: input.box_type ?? null,
            box_count: input.box_count ?? 0,
            remark: input.remark ?? null,
          }
        : item
    );
    mockDb[orderIndex] = {
      ...current,
      items: updatedItems,
      summary: `${updatedItems.length} SKUs / ${updatedItems.reduce((sum, item) => sum + item.requested_qty, 0)} EA`,
    };
    return cloneOrder(mockDb[orderIndex]);
  }

  const rawOrders = await requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options);
  const current = rawOrders.find((order) => order.outbound_no === outboundNo);
  if (!current) throw new ApiError("Outbound order not found", 404);

  await requestJson<RawOutboundItem>(
    `/outbound-items/${itemId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        outbound_order_id: current.id,
        product_id: input.product_id,
        lot_id: input.lot_id,
        location_id: input.location_id ?? null,
        qty: input.qty,
        box_type: input.box_type ?? null,
        box_count: input.box_count ?? 0,
        remark: input.remark ?? null,
      }),
    },
    options
  );

  const updated = await getOutboundOrderByNo(outboundNo, options);
  if (!updated) throw new ApiError("Outbound order not found", 404);
  return updated;
}

export async function deleteOutboundItem(
  outboundNo: string,
  itemId: string,
  options?: RequestOptions
): Promise<OutboundOrder> {
  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const orderIndex = mockDb.findIndex((item) => item.outbound_no === outboundNo);
    if (orderIndex < 0) throw new ApiError("Outbound order not found", 404);
    const current = mockDb[orderIndex];
    const updatedItems = current.items.filter((item) => item.id !== itemId);
    mockDb[orderIndex] = {
      ...current,
      items: updatedItems,
      summary: `${updatedItems.length} SKUs / ${updatedItems.reduce((sum, item) => sum + item.requested_qty, 0)} EA`,
    };
    return cloneOrder(mockDb[orderIndex]);
  }

  await requestVoid(`/outbound-items/${itemId}`, { method: "DELETE" }, options);
  const updated = await getOutboundOrderByNo(outboundNo, options);
  if (!updated) throw new ApiError("Outbound order not found", 404);
  return updated;
}

export type AddBoxPayload = {
  box_no: string;
  courier: string;
  tracking_no: string;
  item_count: number;
};

export async function addOutboundBox(
  outboundNo: string,
  payload: AddBoxPayload,
  options?: RequestOptions
): Promise<OutboundBox[]> {
  if (!shouldUseMockMode()) {
    const current = await (async () => {
      const rawOrders = await requestJson<RawOutboundOrder[]>("/outbound-orders", undefined, options);
      const found = rawOrders.find((order) => order.outbound_no === outboundNo);
      if (!found) throw new ApiError("Outbound order not found", 404);
      return found;
    })();
    try {
      await requestJson<RawOutboundBox>(
        `/outbound-orders/${current.id}/boxes`,
        {
          method: "POST",
          body: JSON.stringify({
            box_no: payload.box_no,
            courier: payload.courier,
            tracking_no: payload.tracking_no,
            item_count: payload.item_count,
          }),
        },
        options
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError("Box API endpoint is not available on current backend.", 404);
      }
      throw error;
    }

    const boxes = await requestJson<RawOutboundBox[]>(`/outbound-orders/${current.id}/boxes`, undefined, options);
    return mapBoxes(boxes, null);
  }

  await delay(LATENCY_MS);
  const idx = mockDb.findIndex((item) => item.outbound_no === outboundNo);
  if (idx < 0) throw new ApiError("Outbound order not found", 404);

  const nextBox: OutboundBox = { id: `BOX-${Date.now()}`, ...payload };
  const updated = { ...mockDb[idx], boxes: [nextBox, ...mockDb[idx].boxes] };
  mockDb[idx] = updated;
  return updated.boxes.map((box) => ({ ...box }));
}

export async function createOutboundOrderWithItems(
  input: CreateOutboundOrderInput,
  options?: RequestOptions
): Promise<OutboundOrder> {
  const items = input.items ?? [];

  if (shouldUseMockMode()) {
    await delay(LATENCY_MS);
    const now = new Date().toISOString();
    const rawOrder: RawOutboundOrder = {
      id: Date.now(),
      outbound_no: input.outbound_no,
      client_id: input.client_id,
      warehouse_id: input.warehouse_id,
      order_date: input.order_date,
      sales_channel: input.sales_channel ?? null,
      order_no: input.order_no ?? null,
      tracking_no: input.tracking_no ?? null,
      status: input.status ?? "draft",
      packed_at: null,
      shipped_at: null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    const mappedItems: OutboundItem[] = items.map((item, index) => ({
      id: `mock-outbound-item-${Date.now()}-${index}`,
      product_id: item.product_id,
      lot_id: item.lot_id,
      location_id: item.location_id ?? null,
      barcode_full: `P-${item.product_id}`,
      product_name: `Product #${item.product_id}`,
      lot: `LOT-${item.lot_id}`,
      location: item.location_id ? `LOC-${item.location_id}` : "-",
      box_type: item.box_type ?? null,
      box_count: item.box_count ?? 0,
      remark: item.remark ?? null,
      requested_qty: item.qty,
      picked_qty: 0,
      available_qty: 0,
      reserved_qty: 0,
      allocatable_qty: 0,
      network_allocatable_qty: 0,
      shortage_qty: item.qty,
      status: "shortage",
      allocation_plan: [],
    }));
    const created = mapOutboundOrder(rawOrder, `Client #${input.client_id}`, mappedItems, []);
    mockDb.unshift(created);
    return cloneOrder(created);
  }

  const created = await requestJson<RawOutboundOrder>(
    "/outbound-orders",
    {
      method: "POST",
      body: JSON.stringify({
        outbound_no: input.outbound_no,
        client_id: input.client_id,
        warehouse_id: input.warehouse_id,
        order_date: input.order_date,
        sales_channel: input.sales_channel ?? null,
        order_no: input.order_no ?? null,
        tracking_no: input.tracking_no ?? null,
        status: input.status ?? "draft",
        packed_at: null,
        shipped_at: null,
        created_by: input.created_by,
      }),
    },
    options
  );

  for (const item of items) {
    await requestJson<RawOutboundItem>(
      "/outbound-items",
      {
        method: "POST",
        body: JSON.stringify({
          outbound_order_id: created.id,
          product_id: item.product_id,
          lot_id: item.lot_id,
          location_id: item.location_id ?? null,
          qty: item.qty,
          box_type: item.box_type ?? null,
          box_count: item.box_count ?? 0,
          remark: item.remark ?? null,
        }),
      },
      options
    );
  }

  const reloaded = await getOutboundOrderByNo(created.outbound_no, options);
  return reloaded ?? mapOutboundOrder(created, "", [], []);
}

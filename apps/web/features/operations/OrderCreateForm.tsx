"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { createInboundOrderWithItems, type CreateInboundItemInput } from "@/features/inbound/api";
import { createOutboundOrderWithItems, type CreateOutboundItemInput } from "@/features/outbound/api";
import { listClients } from "@/features/settings/clients/api";
import type { Client } from "@/features/settings/clients/types";
import { createProductLot, listProductLots, type ProductLotOption } from "@/features/operations/productLotsApi";
import { listWarehouseLocations, type WarehouseLocationOption } from "@/features/operations/warehouseLocationsApi";
import { listProducts } from "@/features/settings/products/api";
import type { Product } from "@/features/settings/products/types";
import { listSalesChannels, type SalesChannel } from "@/features/settings/sales-channels/api";
import { listWarehouses } from "@/features/settings/warehouses/api";
import type { Warehouse } from "@/features/settings/warehouses/types";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { useI18n } from "@/lib/i18n/I18nProvider";

type OrderMode = "inbound" | "outbound";

type ItemDraft = {
  id: string;
  product_id: string;
  lot_id: string;
  lot_no: string;
  location_id: string;
  qty: string;
  invoice_price: string;
  currency: "" | "KRW" | "THB" | "USD";
  box_type: string;
  box_count: string;
  remark: string;
};

type ItemField = keyof Pick<
  ItemDraft,
  "product_id" | "lot_id" | "lot_no" | "location_id" | "qty" | "invoice_price" | "box_type" | "box_count" | "remark"
>;

type ItemFieldErrors = Partial<Record<ItemField, string>>;

type ApiValidationDetail = {
  path?: string | Array<string | number>;
  message?: string;
};

type ValidatedItemDraft = {
  productId: number;
  lotId: number | null;
  lotNo: string;
  qty: number;
  locationId: number | null;
  invoicePrice: number | null;
  boxCount: number;
};

type StockBalanceOption = {
  product_id: number;
  lot_id: number;
  warehouse_id: number;
  location_id: number | null;
  available_qty: number;
  reserved_qty: number;
};

type MasterState = {
  clients: Client[];
  warehouses: Warehouse[];
  products: Product[];
  lots: ProductLotOption[];
  locations: WarehouseLocationOption[];
  stockBalances: StockBalanceOption[];
  salesChannels: SalesChannel[];
};

const inputLabelClass = "mb-1 block text-xs font-medium text-slate-600";
const selectClass =
  "h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300";
const fieldErrorClass = "mt-1 text-xs text-rose-600";
const inboundItemGridTemplate =
  "minmax(220px,1.5fr) minmax(150px,1fr) minmax(160px,1fr) minmax(80px,.55fr) minmax(90px,.6fr) minmax(125px,.85fr) minmax(125px,.85fr) minmax(150px,1fr) 2rem";
const outboundItemGridTemplate =
  "minmax(220px,1.5fr) minmax(150px,1fr) minmax(160px,1fr) minmax(80px,.55fr) minmax(130px,.9fr) minmax(95px,.65fr) minmax(170px,1fr) 2rem";
const currencies: Array<NonNullable<ItemDraft["currency"]>> = ["USD", "THB", "KRW"];
const apiItemFieldMap: Record<string, ItemField> = {
  product_id: "product_id",
  lot_id: "lot_id",
  location_id: "location_id",
  qty: "qty",
  invoice_price: "invoice_price",
  box_type: "box_type",
  box_count: "box_count",
  remark: "remark",
};
const apiItemFieldLabels: Record<ItemField, string> = {
  product_id: "Product",
  lot_id: "Lot No",
  lot_no: "Lot No",
  location_id: "Stock Location",
  qty: "Qty",
  invoice_price: "Invoice Price",
  box_type: "Box Type",
  box_count: "Box Count",
  remark: "Remark",
};

function withFieldErrorClass(baseClass: string, hasError: boolean) {
  return hasError ? `${baseClass} border-rose-400 bg-rose-50` : baseClass;
}

function toDateInputValue(date = new Date()) {
  return formatDateInAppZone(date);
}

function formatDateInAppZone(date: Date) {
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

function formatTimeInAppZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}${minute}`;
}

function toPositiveIntId(value: string | number | undefined | null) {
  const direct = Number(value);
  if (Number.isInteger(direct) && direct > 0) return direct;

  const match = String(value ?? "").match(/(\d+)$/);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function makeDefaultOrderNo(mode: OrderMode) {
  const now = new Date();
  const date = formatDateInAppZone(now).replace(/-/g, "");
  const time = formatTimeInAppZone(now);
  return `${mode === "inbound" ? "INB" : "OUT"}-${date}-${time}`;
}

function makeItemDraft(): ItemDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    product_id: "",
    lot_id: "",
    lot_no: "",
    location_id: "",
    qty: "1",
    invoice_price: "",
    currency: "USD",
    box_type: "",
    box_count: "0",
    remark: "",
  };
}

function toOptionalPositiveInt(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toOptionalNonNegativeInt(value: string) {
  if (!value.trim()) return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function toOptionalPositiveNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatOptionalDate(value?: string | null) {
  return value ? value.slice(0, 10) : "-";
}

function formatOptionalAmount(value: number | null, currency?: string) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${currency || ""} ${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`.trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

function normalizeApiDetailPath(path: ApiValidationDetail["path"]) {
  if (Array.isArray(path)) return path.map((part) => String(part)).filter(Boolean).join(".");
  return String(path ?? "").trim();
}

function getApiValidationDetails(error: unknown) {
  const details = (error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return [];
  return details
    .map((detail) => {
      if (typeof detail === "string") return { path: "", message: detail };
      if (!detail || typeof detail !== "object") return null;
      const candidate = detail as ApiValidationDetail;
      return {
        path: normalizeApiDetailPath(candidate.path),
        message: String(candidate.message ?? "").trim(),
      };
    })
    .filter((detail): detail is { path: string; message: string } => Boolean(detail?.message || detail?.path));
}

async function listStockBalancesForForm(): Promise<StockBalanceOption[]> {
  if (typeof window === "undefined") return [];
  try {
    const response = await fetch("/api/proxy/stock-balances", { cache: "no-store" });
    const json = (await response.json()) as { ok?: boolean; data?: StockBalanceOption[] };
    if (!response.ok || !json.ok || !Array.isArray(json.data)) return [];
    return json.data.map((row) => ({
      product_id: Number(row.product_id),
      lot_id: Number(row.lot_id),
      warehouse_id: Number(row.warehouse_id),
      location_id: row.location_id == null ? null : Number(row.location_id),
      available_qty: Number(row.available_qty || 0),
      reserved_qty: Number(row.reserved_qty || 0),
    }));
  } catch {
    return [];
  }
}

export function OrderCreateForm({ mode }: { mode: OrderMode }) {
  const { t } = useI18n();
  const router = useRouter();
  const { user, ready, canWrite } = useCurrentUser();
  const [masters, setMasters] = useState<MasterState>({
    clients: [],
    warehouses: [],
    products: [],
    lots: [],
    locations: [],
    stockBalances: [],
    salesChannels: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState(() => makeDefaultOrderNo(mode));
  const [date, setDate] = useState(() => toDateInputValue());
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [memo, setMemo] = useState("");
  const [salesChannel, setSalesChannel] = useState(mode === "outbound" ? "manual" : "");
  const [platformOrderNo, setPlatformOrderNo] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() => (mode === "inbound" ? [makeItemDraft()] : []));
  const [itemErrors, setItemErrors] = useState<Record<string, ItemFieldErrors>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      listClients(),
      listWarehouses(),
      listProducts(),
      listProductLots(),
      listWarehouseLocations({ status: "active" }),
      listStockBalancesForForm(),
      listSalesChannels(),
    ])
      .then(([clients, warehouses, products, lots, locations, stockBalances, salesChannels]) => {
        if (cancelled) return;
        setMasters({ clients, warehouses, products, lots, locations, stockBalances, salesChannels });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeClients = useMemo(
    () => masters.clients.filter((client) => client.status === "active"),
    [masters.clients]
  );
  const activeWarehouses = useMemo(
    () => masters.warehouses.filter((warehouse) => warehouse.status === "active"),
    [masters.warehouses]
  );
  const selectedClient = activeClients.find((client) => String(toPositiveIntId(client.id)) === clientId);
  const filteredProducts = useMemo(() => {
    const selectedClientNumber = toPositiveIntId(clientId);
    return masters.products
      .filter((product) => product.status === "active")
      .filter((product) => {
        if (!selectedClientNumber && !selectedClient?.client_code) return true;
        return (
          Number(product.client_id) === selectedClientNumber ||
          product.client_code === selectedClient?.client_code
        );
      });
  }, [clientId, masters.products, selectedClient?.client_code]);

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of filteredProducts) {
      const id = toPositiveIntId(product.id);
      if (id) map.set(String(id), product);
    }
    return map;
  }, [filteredProducts]);

  const lotsByProductId = useMemo(() => {
    const map = new Map<string, ProductLotOption[]>();
    for (const lot of masters.lots.filter((item) => item.status === "active")) {
      const key = String(lot.product_id);
      map.set(key, [...(map.get(key) ?? []), lot]);
    }
    return map;
  }, [masters.lots]);

  const activeLocations = useMemo(() => {
    const selectedWarehouseId = toPositiveIntId(warehouseId);
    return masters.locations
      .filter((location) => location.status === "active")
      .filter((location) => !selectedWarehouseId || Number(location.warehouse_id) === selectedWarehouseId);
  }, [masters.locations, warehouseId]);
  const activeSalesChannels = useMemo(
    () => masters.salesChannels.filter((channel) => channel.status === "active"),
    [masters.salesChannels]
  );

  const title = mode === "inbound" ? "New Inbound" : "New Outbound";
  const listHref = mode === "inbound" ? "/inbounds" : "/outbounds";

  function getSelectedLot(item: ItemDraft) {
    const lots = lotsByProductId.get(item.product_id) ?? [];
    if (item.lot_id) return lots.find((lot) => String(lot.id) === item.lot_id) ?? null;
    const lotNo = item.lot_no.trim().toLowerCase();
    if (!lotNo) return null;
    return lots.find((lot) => lot.lot_no.trim().toLowerCase() === lotNo) ?? null;
  }

  function getLineTotal(item: ItemDraft) {
    const qty = toOptionalPositiveInt(item.qty);
    const price = toOptionalPositiveNumber(item.invoice_price);
    if (!qty || price === null) return null;
    return qty * price;
  }

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setItemErrors((current) => {
      const existing = current[id];
      if (!existing) return current;
      const nextFields = { ...existing };
      for (const key of Object.keys(patch) as ItemField[]) {
        delete nextFields[key];
      }
      if (Object.keys(nextFields).length === 0) {
        const { [id]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [id]: nextFields };
    });
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setItemErrors((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }

  function getOutboundStock(item: ItemDraft) {
    const productId = toOptionalPositiveInt(item.product_id);
    const lotId = toOptionalPositiveInt(item.lot_id);
    const warehouse = toOptionalPositiveInt(warehouseId);
    const locationId = toOptionalPositiveInt(item.location_id);
    if (!productId || !lotId || !warehouse) return null;

    const matches = masters.stockBalances.filter((balance) => {
      if (Number(balance.product_id) !== productId) return false;
      if (Number(balance.lot_id) !== lotId) return false;
      if (Number(balance.warehouse_id) !== warehouse) return false;
      if (locationId && Number(balance.location_id || 0) !== locationId) return false;
      return true;
    });
    if (matches.length === 0) return { available: 0, reserved: 0, allocatable: 0 };
    const available = matches.reduce((sum, balance) => sum + Number(balance.available_qty || 0), 0);
    const reserved = matches.reduce((sum, balance) => sum + Number(balance.reserved_qty || 0), 0);
    return { available, reserved, allocatable: Math.max(available - reserved, 0) };
  }

  function validateItemDraft(item: ItemDraft): { value: ValidatedItemDraft; errors: ItemFieldErrors } {
    const productId = toOptionalPositiveInt(item.product_id);
    const lotId = toOptionalPositiveInt(item.lot_id);
    const lotNo = item.lot_no.trim();
    const qty = toOptionalPositiveInt(item.qty);
    const locationId = toOptionalPositiveInt(item.location_id);
    const invoicePrice = toOptionalPositiveNumber(item.invoice_price);
    const boxCount = toOptionalNonNegativeInt(item.box_count);
    const errors: ItemFieldErrors = {};

    if (!productId) errors.product_id = "Select a product.";
    if (mode === "inbound") {
      if (!lotNo) errors.lot_no = "Enter a LOT No.";
    } else if (!lotId) {
      errors.lot_id = "Select a lot.";
    }
    if (!qty) errors.qty = "Enter a positive quantity.";
    if (item.location_id.trim() && !locationId) {
      errors.location_id = "Select a valid location.";
    }
    if (item.invoice_price.trim() && invoicePrice == null) {
      errors.invoice_price = "Enter a positive invoice price.";
    }
    if (boxCount == null) errors.box_count = "Enter zero or greater.";

    if (mode === "outbound" && productId && lotId && qty && masters.stockBalances.length > 0) {
      const stock = getOutboundStock(item);
      if (stock && stock.allocatable <= 0) {
        errors.qty = "No stock is available for this product lot.";
      } else if (stock && qty > stock.allocatable) {
        errors.qty = `Qty exceeds available stock (${stock.allocatable}).`;
      }
    }

    return {
      value: {
        productId: productId ?? 0,
        lotId: lotId ?? null,
        lotNo,
        qty: qty ?? 0,
        locationId,
        invoicePrice,
        boxCount: boxCount ?? 0,
      },
      errors,
    };
  }

  function applyApiValidationErrors(saveError: unknown) {
    const details = getApiValidationDetails(saveError);
    if (details.length === 0) return false;

    const nextItemErrors: Record<string, ItemFieldErrors> = {};
    const friendlyMessages: string[] = [];

    for (const detail of details) {
      const path = detail.path;
      const itemMatch = path.match(/^items\.(\d+)\.([a-z_]+)$/);
      if (!itemMatch) {
        const label = path || "Request";
        friendlyMessages.push(`${label}: ${detail.message}`);
        continue;
      }

      const itemIndex = Number(itemMatch[1]);
      const apiField = itemMatch[2];
      const field: ItemField | undefined = apiField === "lot_id" && mode === "inbound" ? "lot_no" : apiItemFieldMap[apiField];
      const draft = items[itemIndex];
      const label = field ? apiItemFieldLabels[field] : apiField;
      const friendlyMessage = `Item ${itemIndex + 1} / ${label}: ${detail.message}`;
      friendlyMessages.push(friendlyMessage);

      if (draft && field) {
        nextItemErrors[draft.id] = {
          ...(nextItemErrors[draft.id] ?? {}),
          [field]: detail.message,
        };
      }
    }

    if (Object.keys(nextItemErrors).length > 0) {
      setItemErrors(nextItemErrors);
    }
    setError(friendlyMessages.join("; ") || getErrorMessage(saveError));
    return true;
  }

  async function resolveInboundLotId(productId: number, lotNo: string) {
    const normalizedLotNo = lotNo.trim().toLowerCase();
    const existing = masters.lots.find(
      (lot) => Number(lot.product_id) === productId && lot.lot_no.trim().toLowerCase() === normalizedLotNo
    );
    const existingId = toPositiveIntId(existing?.id);
    if (existingId) return existingId;

    const created = await createProductLot({
      product_id: productId,
      lot_no: lotNo.trim(),
      status: "active",
    });
    const createdId = toPositiveIntId(created.id);
    if (!createdId) throw new Error(`Unable to create lot ${lotNo}.`);
    return createdId;
  }

  async function submit() {
    setError(null);
    if (!user) {
      setError("Login is required.");
      return;
    }

    const client = toOptionalPositiveInt(clientId);
    const warehouse = toOptionalPositiveInt(warehouseId);
    if (!orderNo.trim()) {
      setError(mode === "inbound" ? "Inbound No is required." : "Outbound No is required.");
      return;
    }
    if (!client || !warehouse || !date) {
      setError("Client, warehouse and date are required.");
      return;
    }

    try {
      setSaving(true);
      const validations = items.map((item) => ({ id: item.id, ...validateItemDraft(item) }));
      const nextItemErrors = validations.reduce<Record<string, ItemFieldErrors>>((acc, validation) => {
        if (Object.keys(validation.errors).length > 0) {
          acc[validation.id] = validation.errors;
        }
        return acc;
      }, {});
      setItemErrors(nextItemErrors);
      if (Object.keys(nextItemErrors).length > 0) {
        setError("Please fix the highlighted item fields.");
        return;
      }
      const validatedItems = validations.map((validation) => validation.value);

      if (mode === "inbound") {
        const itemPayloads: CreateInboundItemInput[] = await Promise.all(
          validatedItems.map(async (item, index) => ({
            product_id: item.productId,
            lot_id: await resolveInboundLotId(item.productId, item.lotNo),
            location_id: item.locationId,
            qty: item.qty,
            invoice_price: item.invoicePrice,
            currency: item.invoicePrice === null ? null : items[index].currency || "USD",
            remark: items[index].remark.trim() || null,
          }))
        );
        const created = await createInboundOrderWithItems({
          inbound_no: orderNo.trim(),
          client_id: client,
          warehouse_id: warehouse,
          inbound_date: date,
          status: "draft",
          memo: memo.trim() || null,
          created_by: user.id,
          items: itemPayloads,
        });
        router.push(`/inbounds/${encodeURIComponent(created.inbound_no)}`);
      } else {
        const itemPayloads: CreateOutboundItemInput[] = validatedItems.map((item, index) => {
          if (!item.lotId) throw new Error(`Item ${index + 1}: lot is required.`);
          return {
            product_id: item.productId,
            lot_id: item.lotId,
            location_id: item.locationId,
            qty: item.qty,
            box_type: items[index].box_type.trim() || null,
            box_count: item.boxCount,
            remark: items[index].remark.trim() || null,
          };
        });
        const created = await createOutboundOrderWithItems({
          outbound_no: orderNo.trim(),
          client_id: client,
          warehouse_id: warehouse,
          order_date: date,
          sales_channel: salesChannel.trim() || null,
          order_no: platformOrderNo.trim() || null,
          tracking_no: trackingNo.trim() || null,
          status: "draft",
          created_by: user.id,
          items: itemPayloads,
        });
        router.push(`/outbounds/${encodeURIComponent(created.outbound_no)}`);
      }
      router.refresh();
    } catch (saveError) {
      if (!applyApiValidationErrors(saveError)) {
        setError(getErrorMessage(saveError));
      }
    } finally {
      setSaving(false);
    }
  }

  if (ready && !canWrite) {
    return (
      <section>
        <PageHeader
          breadcrumbs={[{ label: "Operations" }, { label: title }]}
          title={title}
          rightSlot={
            <Link href={listHref}>
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          }
        />
        <ErrorState title="Read-only role" message="This account cannot create inbound or outbound orders." />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        breadcrumbs={[{ label: "Operations" }, { label: title }]}
        title={title}
        subtitle={mode === "inbound" ? "Create a draft inbound order." : "Create as draft, add items, then ship from detail."}
        rightSlot={
          <div className="flex gap-2">
            <Link href={listHref}>
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button onClick={() => void submit()} disabled={!ready || loading || saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      {error ? <div className="mb-4"><ErrorState title="Unable to create order" message={error} /></div> : null}

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label>
                <span className={inputLabelClass}>{mode === "inbound" ? t("Inbound No") : t("Outbound No")}</span>
                <Input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} />
              </label>
              <label>
                <span className={inputLabelClass}>{mode === "inbound" ? t("Inbound Date") : t("Order Date")}</span>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                <span className={inputLabelClass}>{t("Client")}</span>
                <select
                  className={selectClass}
                  value={clientId}
                  onChange={(event) => {
                    setClientId(event.target.value);
                    setItems(mode === "inbound" ? [makeItemDraft()] : []);
                    setItemErrors({});
                  }}
                >
                  <option value="">Select client</option>
                  {activeClients.map((client) => {
                    const id = toPositiveIntId(client.id);
                    if (!id) return null;
                    return (
                      <option key={client.id} value={id}>
                        {client.client_code} | {client.name}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                <span className={inputLabelClass}>{t("Warehouse")}</span>
                <select
                  className={selectClass}
                  value={warehouseId}
                  onChange={(event) => {
                    setWarehouseId(event.target.value);
                    setItems((current) => current.map((item) => ({ ...item, location_id: "" })));
                    setItemErrors({});
                  }}
                >
                  <option value="">Select warehouse</option>
                  {activeWarehouses.map((warehouse) => {
                    const id = toPositiveIntId(warehouse.id);
                    if (!id) return null;
                    return (
                      <option key={warehouse.id} value={id}>
                        {warehouse.warehouse_code} | {warehouse.name}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {mode === "inbound" ? (
              <label className="mt-4 block">
                <span className={inputLabelClass}>{t("Memo")}</span>
                <Input value={memo} onChange={(event) => setMemo(event.target.value)} />
              </label>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label>
                  <span className={inputLabelClass}>{t("Sales Channel")}</span>
                  <select
                    className={selectClass}
                    value={salesChannel}
                    onChange={(event) => setSalesChannel(event.target.value)}
                  >
                    <option value="">Select sales channel</option>
                    {activeSalesChannels.map((channel) => (
                      <option key={channel.id} value={channel.name}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={inputLabelClass}>{t("Order No")}</span>
                  <Input value={platformOrderNo} onChange={(event) => setPlatformOrderNo(event.target.value)} />
                </label>
                <label>
                  <span className={inputLabelClass}>{t("Tracking No")}</span>
                  <Input value={trackingNo} onChange={(event) => setTrackingNo(event.target.value)} />
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Items</CardTitle>
            <Button variant="secondary" size="sm" onClick={() => setItems((current) => [...current, makeItemDraft()])}>
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-slate-500">
                No items added.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const lots = lotsByProductId.get(item.product_id) ?? [];
                  const product = productsById.get(item.product_id);
                  const selectedLot = getSelectedLot(item);
                  const lineTotal = getLineTotal(item);
                  const errors = itemErrors[item.id] ?? {};
                  const outboundStock = mode === "outbound" ? getOutboundStock(item) : null;
                  const showItemLabels = index === 0;
                  return (
                    <div key={item.id} className="rounded-md border p-3">
                      {showItemLabels ? <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">Item {index + 1}</div>
                      </div> : null}
                      <div className="overflow-x-auto">
                      <div
                        className={`grid ${mode === "inbound" ? "min-w-[1180px]" : "min-w-[1080px]"} items-start gap-3`}
                        style={{ gridTemplateColumns: mode === "inbound" ? inboundItemGridTemplate : outboundItemGridTemplate }}
                      >
                        <label>
                          {showItemLabels ? <span className={inputLabelClass}>{t("Product")}</span> : null}
                          <select
                            className={withFieldErrorClass(selectClass, Boolean(errors.product_id))}
                            value={item.product_id}
                            onChange={(event) => updateItem(item.id, { product_id: event.target.value, lot_id: "", lot_no: "" })}
                            aria-invalid={Boolean(errors.product_id)}
                          >
                            <option value="">Select product</option>
                            {filteredProducts.map((nextProduct) => {
                              const id = toPositiveIntId(nextProduct.id);
                              if (!id) return null;
                              return (
                                <option key={nextProduct.id} value={id}>
                                  {nextProduct.barcode_full} | {nextProduct.name}
                                </option>
                              );
                            })}
                          </select>
                          {errors.product_id ? <p className={fieldErrorClass}>{errors.product_id}</p> : null}
                          {showItemLabels ? <p className="mt-1 text-xs text-slate-500">
                            {t("Barcode")}: {product?.barcode_full ?? "-"}
                          </p> : null}
                        </label>
                        {mode === "inbound" ? (
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>LOT No / Lot No</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.lot_no))}
                              list={`lot-options-${item.id}`}
                              placeholder={product ? "Enter lot no" : "Select product first"}
                              value={item.lot_no}
                              onChange={(event) => updateItem(item.id, { lot_no: event.target.value, lot_id: "" })}
                              disabled={!item.product_id}
                              aria-invalid={Boolean(errors.lot_no)}
                            />
                            {errors.lot_no ? <p className={fieldErrorClass}>{errors.lot_no}</p> : null}
                            {lots.length > 0 ? (
                              <datalist id={`lot-options-${item.id}`}>
                                {lots.map((lot) => (
                                  <option key={lot.id} value={lot.lot_no} />
                                ))}
                              </datalist>
                            ) : null}
                            {showItemLabels ? <p className="mt-1 text-xs text-slate-500">
                              {t("Expiry Date")}: {formatOptionalDate(selectedLot?.expiry_date)}
                            </p> : null}
                          </label>
                        ) : (
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Lot")}</span> : null}
                            <select
                              className={withFieldErrorClass(selectClass, Boolean(errors.lot_id))}
                              value={item.lot_id}
                              onChange={(event) => updateItem(item.id, { lot_id: event.target.value })}
                              disabled={!item.product_id}
                              aria-invalid={Boolean(errors.lot_id)}
                            >
                              <option value="">{product ? "Select lot" : "Select product first"}</option>
                              {lots.map((lot) => (
                                <option key={lot.id} value={lot.id}>
                                  {lot.lot_no}
                                </option>
                              ))}
                            </select>
                            {errors.lot_id ? <p className={fieldErrorClass}>{errors.lot_id}</p> : null}
                            {showItemLabels && item.product_id && lots.length === 0 ? (
                              <p className="mt-1 text-xs text-amber-700">
                                No lot exists for this product. Receive stock first or choose another product.
                              </p>
                            ) : null}
                            {showItemLabels && outboundStock ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Available stock: {outboundStock.allocatable} EA
                                {outboundStock.reserved > 0 ? ` (${outboundStock.reserved} reserved)` : ""}
                              </p>
                            ) : null}
                            {showItemLabels ? <p className="mt-1 text-xs text-slate-500">
                              {t("Expiry Date")}: {formatOptionalDate(selectedLot?.expiry_date)}
                            </p> : null}
                          </label>
                        )}
                        <label>
                          {showItemLabels ? <span className={inputLabelClass}>{mode === "inbound" ? "Stock Location" : t("Location")}</span> : null}
                          {activeLocations.length > 0 ? (
                            <select
                              className={withFieldErrorClass(selectClass, Boolean(errors.location_id))}
                              value={item.location_id}
                              onChange={(event) => updateItem(item.id, { location_id: event.target.value })}
                              disabled={!warehouseId}
                              aria-invalid={Boolean(errors.location_id)}
                            >
                              <option value="">None</option>
                              {activeLocations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.location_code}{location.zone ? ` | ${location.zone}` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.location_id))}
                              placeholder={warehouseId ? "Optional location ID" : "Select warehouse first"}
                              value={item.location_id}
                              onChange={(event) => updateItem(item.id, { location_id: event.target.value })}
                              disabled={!warehouseId}
                              aria-invalid={Boolean(errors.location_id)}
                            />
                          )}
                          {errors.location_id ? <p className={fieldErrorClass}>{errors.location_id}</p> : null}
                        </label>
                        <label>
                          {showItemLabels ? <span className={inputLabelClass}>{t("Qty")}</span> : null}
                          <Input
                            className={withFieldErrorClass("", Boolean(errors.qty))}
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(event) => updateItem(item.id, { qty: event.target.value })}
                            aria-invalid={Boolean(errors.qty)}
                          />
                          {errors.qty ? <p className={fieldErrorClass}>{errors.qty}</p> : null}
                        </label>

                        {mode === "inbound" ? (
                          <>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Currency")}</span> : null}
                            <select
                              className={selectClass}
                              value={item.currency}
                              onChange={(event) => updateItem(item.id, { currency: event.target.value as ItemDraft["currency"] })}
                            >
                              <option value="">None</option>
                              {currencies.map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Invoice Price")}</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.invoice_price))}
                              type="number"
                              min={0}
                              step="0.0001"
                              value={item.invoice_price}
                              onChange={(event) => updateItem(item.id, { invoice_price: event.target.value })}
                              aria-invalid={Boolean(errors.invoice_price)}
                            />
                            {errors.invoice_price ? <p className={fieldErrorClass}>{errors.invoice_price}</p> : null}
                          </label>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Total Amount")}</span> : null}
                            <div className="h-9 rounded-md bg-slate-50 px-3 py-2 text-sm tabular-nums text-slate-700">
                              {formatOptionalAmount(lineTotal, item.currency)}
                            </div>
                          </label>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Remark")}</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.remark))}
                              value={item.remark}
                              onChange={(event) => updateItem(item.id, { remark: event.target.value })}
                              aria-invalid={Boolean(errors.remark)}
                            />
                            {errors.remark ? <p className={fieldErrorClass}>{errors.remark}</p> : null}
                          </label>
                          </>
                        ) : (
                          <>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Packed Box")} / {t("Box Type")}</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.box_type))}
                              value={item.box_type}
                              onChange={(event) => updateItem(item.id, { box_type: event.target.value })}
                              aria-invalid={Boolean(errors.box_type)}
                            />
                            {errors.box_type ? <p className={fieldErrorClass}>{errors.box_type}</p> : null}
                          </label>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Box Count")}</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.box_count))}
                              type="number"
                              min={0}
                              value={item.box_count}
                              onChange={(event) => updateItem(item.id, { box_count: event.target.value })}
                              aria-invalid={Boolean(errors.box_count)}
                            />
                            {errors.box_count ? <p className={fieldErrorClass}>{errors.box_count}</p> : null}
                          </label>
                          <label>
                            {showItemLabels ? <span className={inputLabelClass}>{t("Remark")}</span> : null}
                            <Input
                              className={withFieldErrorClass("", Boolean(errors.remark))}
                              value={item.remark}
                              onChange={(event) => updateItem(item.id, { remark: event.target.value })}
                              aria-invalid={Boolean(errors.remark)}
                            />
                            {errors.remark ? <p className={fieldErrorClass}>{errors.remark}</p> : null}
                          </label>
                          </>
                        )}
                        <div className={showItemLabels ? "pt-6" : ""}>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label="Remove item">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

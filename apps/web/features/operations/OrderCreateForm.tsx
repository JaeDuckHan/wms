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

type MasterState = {
  clients: Client[];
  warehouses: Warehouse[];
  products: Product[];
  lots: ProductLotOption[];
  locations: WarehouseLocationOption[];
};

const inputLabelClass = "mb-1 block text-xs font-medium text-slate-600";
const selectClass =
  "h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300";

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
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
  const [items, setItems] = useState<ItemDraft[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([listClients(), listWarehouses(), listProducts(), listProductLots(), listWarehouseLocations({ status: "active" })])
      .then(([clients, warehouses, products, lots, locations]) => {
        if (cancelled) return;
        setMasters({ clients, warehouses, products, lots, locations });
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

  const title = mode === "inbound" ? "New Inbound" : "New Outbound";
  const listHref = mode === "inbound" ? "/inbounds" : "/outbounds";

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function validateItemDraft(item: ItemDraft, index: number) {
    const productId = toOptionalPositiveInt(item.product_id);
    const lotId = toOptionalPositiveInt(item.lot_id);
    const lotNo = item.lot_no.trim();
    const qty = toOptionalPositiveInt(item.qty);
    const locationId = toOptionalPositiveInt(item.location_id);
    const invoicePrice = toOptionalPositiveNumber(item.invoice_price);
    const boxCount = toOptionalNonNegativeInt(item.box_count);

    if (!productId) throw new Error(`Item ${index + 1}: product is required.`);
    if (mode === "inbound") {
      if (!lotNo) throw new Error(`Item ${index + 1}: lot no is required.`);
    } else if (!lotId) {
      throw new Error(`Item ${index + 1}: lot is required.`);
    }
    if (!qty) throw new Error(`Item ${index + 1}: qty must be a positive integer.`);
    if (item.location_id.trim() && !locationId) {
      throw new Error(`Item ${index + 1}: location_id must be a positive integer.`);
    }
    if (item.invoice_price.trim() && invoicePrice == null) {
      throw new Error(`Item ${index + 1}: invoice price must be a positive number.`);
    }
    if (boxCount == null) throw new Error(`Item ${index + 1}: box count must be zero or greater.`);

    return { productId, lotId, lotNo, qty, locationId, invoicePrice, boxCount };
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
      const validatedItems = items.map((item, index) => validateItemDraft(item, index));

      if (mode === "inbound") {
        const itemPayloads: CreateInboundItemInput[] = await Promise.all(
          validatedItems.map(async (item, index) => ({
            product_id: item.productId,
            lot_id: await resolveInboundLotId(item.productId, item.lotNo),
            location_id: item.locationId,
            qty: item.qty,
            invoice_price: item.invoicePrice,
            currency: item.invoicePrice === null ? null : "USD",
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
      setError(getErrorMessage(saveError));
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
        subtitle={mode === "inbound" ? "Create a draft inbound order." : "Create a draft outbound order."}
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
                    setItems([]);
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
                  <Input value={salesChannel} onChange={(event) => setSalesChannel(event.target.value)} />
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
                  return (
                    <div key={item.id} className="rounded-md border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">Item {index + 1}</div>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label="Remove item">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <label>
                          <span className={inputLabelClass}>{t("Product")}</span>
                          <select
                            className={selectClass}
                            value={item.product_id}
                            onChange={(event) => updateItem(item.id, { product_id: event.target.value, lot_id: "", lot_no: "" })}
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
                        </label>
                        {mode === "inbound" ? (
                          <label>
                            <span className={inputLabelClass}>LOT No / Lot No</span>
                            <Input
                              list={`lot-options-${item.id}`}
                              placeholder={product ? "Enter lot no" : "Select product first"}
                              value={item.lot_no}
                              onChange={(event) => updateItem(item.id, { lot_no: event.target.value, lot_id: "" })}
                              disabled={!item.product_id}
                            />
                            {lots.length > 0 ? (
                              <datalist id={`lot-options-${item.id}`}>
                                {lots.map((lot) => (
                                  <option key={lot.id} value={lot.lot_no} />
                                ))}
                              </datalist>
                            ) : null}
                          </label>
                        ) : (
                          <label>
                            <span className={inputLabelClass}>{t("Lot")}</span>
                            <select
                              className={selectClass}
                              value={item.lot_id}
                              onChange={(event) => updateItem(item.id, { lot_id: event.target.value })}
                              disabled={!item.product_id}
                            >
                              <option value="">{product ? "Select lot" : "Select product first"}</option>
                              {lots.map((lot) => (
                                <option key={lot.id} value={lot.id}>
                                  {lot.lot_no}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          <span className={inputLabelClass}>{mode === "inbound" ? "입고 위치 / Stock Location" : t("Location")}</span>
                          {activeLocations.length > 0 ? (
                            <select
                              className={selectClass}
                              value={item.location_id}
                              onChange={(event) => updateItem(item.id, { location_id: event.target.value })}
                              disabled={!warehouseId}
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
                              placeholder={warehouseId ? "Optional location ID" : "Select warehouse first"}
                              value={item.location_id}
                              onChange={(event) => updateItem(item.id, { location_id: event.target.value })}
                              disabled={!warehouseId}
                            />
                          )}
                        </label>
                        <label>
                          <span className={inputLabelClass}>{t("Qty")}</span>
                          <Input type="number" min={1} value={item.qty} onChange={(event) => updateItem(item.id, { qty: event.target.value })} />
                        </label>
                      </div>

                      {mode === "inbound" ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label>
                            <span className={inputLabelClass}>인보이스 단가(USD) / Invoice Price (USD)</span>
                            <Input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={item.invoice_price}
                              onChange={(event) => updateItem(item.id, { invoice_price: event.target.value })}
                            />
                          </label>
                          <label>
                            <span className={inputLabelClass}>{t("Currency")}</span>
                            <select className={selectClass} value={item.currency || "USD"} disabled>
                              <option value="USD">USD</option>
                            </select>
                          </label>
                          <label>
                            <span className={inputLabelClass}>{t("Remark")}</span>
                            <Input value={item.remark} onChange={(event) => updateItem(item.id, { remark: event.target.value })} />
                          </label>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label>
                            <span className={inputLabelClass}>{t("Box Type")}</span>
                            <Input value={item.box_type} onChange={(event) => updateItem(item.id, { box_type: event.target.value })} />
                          </label>
                          <label>
                            <span className={inputLabelClass}>{t("Box Count")}</span>
                            <Input type="number" min={0} value={item.box_count} onChange={(event) => updateItem(item.id, { box_count: event.target.value })} />
                          </label>
                          <label>
                            <span className={inputLabelClass}>{t("Remark")}</span>
                            <Input value={item.remark} onChange={(event) => updateItem(item.id, { remark: event.target.value })} />
                          </label>
                        </div>
                      )}
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

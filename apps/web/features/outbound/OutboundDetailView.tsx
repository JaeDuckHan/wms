"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Ban, Loader2, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OutboundAction, OutboundBox, OutboundItem, OutboundOrder } from "@/features/outbound/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addOutboundBox,
  ApiError,
  cancelOutboundOrder,
  deleteOutboundBox,
  deleteOutboundItem,
  transitionOutboundStatus,
  updateOutboundBox,
  updateOutboundItem,
  updateOutboundOrderDetails,
} from "@/features/outbound/api";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { listSalesChannels, type SalesChannel } from "@/features/settings/sales-channels/api";
import { buildProductHistoryHref } from "@/features/inventory/productHistoryLinks";
const tabs = ["overview", "items", "boxes", "timeline"] as const;
type TabValue = (typeof tabs)[number];

function asText(value: unknown, fallback = "-") {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOutboundOrder(order: OutboundOrder): OutboundOrder {
  const items = Array.isArray(order.items)
    ? order.items.map((item) => ({
        ...item,
        barcode_full: asText(item.barcode_full),
        product_name: asText(item.product_name),
        lot: asText(item.lot),
        expiry_date: item.expiry_date ? asText(item.expiry_date) : null,
        location: asText(item.location),
        box_type: item.box_type ? asText(item.box_type) : null,
        box_count: asNumber(item.box_count),
        requested_qty: asNumber(item.requested_qty),
        picked_qty: asNumber(item.picked_qty),
        available_qty: asNumber(item.available_qty),
        reserved_qty: asNumber(item.reserved_qty),
        allocatable_qty: asNumber(item.allocatable_qty),
        network_allocatable_qty: asNumber(item.network_allocatable_qty),
        shortage_qty: asNumber(item.shortage_qty),
        allocation_plan: Array.isArray(item.allocation_plan)
          ? item.allocation_plan.map((plan) => ({
              lot: asText(plan.lot),
              location: asText(plan.location),
              allocatable_qty: asNumber(plan.allocatable_qty),
              suggested_qty: asNumber(plan.suggested_qty),
            }))
          : [],
      }))
    : [];
  const boxes = Array.isArray(order.boxes)
    ? order.boxes.map((box) => ({
        ...box,
        box_no: asText(box.box_no),
        courier: asText(box.courier),
        tracking_no: asText(box.tracking_no),
        item_count: asNumber(box.item_count),
        status: box.status ?? "open",
        items: Array.isArray(box.items)
          ? box.items.map((boxItem) => ({
              ...boxItem,
              id: asText(boxItem.id),
              outbound_item_id: asText(boxItem.outbound_item_id),
              barcode_full: asText(boxItem.barcode_full),
              product_name: asText(boxItem.product_name),
              lot: asText(boxItem.lot),
              location: asText(boxItem.location),
              requested_qty: asNumber(boxItem.requested_qty),
              packed_qty: asNumber(boxItem.packed_qty),
            }))
          : [],
      }))
    : [];
  const timeline = Array.isArray(order.timeline)
    ? order.timeline.map((log) => ({
        ...log,
        title: asText(log.title),
        at: asText(log.at),
        actor: asText(log.actor),
        note: log.note ? asText(log.note) : undefined,
      }))
    : [];

  return {
    ...order,
    outbound_no: asText(order.outbound_no),
    order_no: asText(order.order_no, ""),
    tracking_no: asText(order.tracking_no, ""),
    client: asText(order.client),
    eta_date: asText(order.eta_date),
    memo: asText(order.memo),
    ship_to: asText(order.ship_to),
    summary: asText(order.summary),
    items,
    boxes,
    boxes_supported: Boolean(order.boxes_supported),
    timeline,
  };
}

function normalizeTab(tab?: string): TabValue {
  if (tab && tabs.includes(tab as TabValue)) return tab as TabValue;
  return "overview";
}

function actionByStatus(status: OutboundOrder["status"]): OutboundAction | null {
  if (status === "draft") return "allocate";
  if (status === "allocated" || status === "picking") return "pack";
  if (status === "packing" || status === "packed") return "ship";
  return null;
}

function actionLabel(action: OutboundAction) {
  if (action === "allocate") return "Allocate";
  if (action === "pack") return "Pack";
  return "Ship";
}

export function OutboundDetailView({
  order: initialOrder,
  initialTab,
}: {
  order: OutboundOrder;
  initialTab?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { t } = useI18n();
  const { canWrite, ready } = useCurrentUser();
  const normalizedOrder = useMemo(() => normalizeOutboundOrder(initialOrder), [initialOrder]);

  const [tab, setTab] = useState<TabValue>(normalizeTab(initialTab));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [boxNo, setBoxNo] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [editingBox, setEditingBox] = useState<OutboundBox | null>(null);
  const [boxItemQtyById, setBoxItemQtyById] = useState<Record<string, string>>({});
  const [editDate, setEditDate] = useState(normalizedOrder.eta_date);
  const [editSalesChannel, setEditSalesChannel] = useState(normalizedOrder.memo === "N/A" ? "" : normalizedOrder.memo);
  const [editOrderNo, setEditOrderNo] = useState(normalizedOrder.order_no);
  const [editTrackingNo, setEditTrackingNo] = useState(normalizedOrder.tracking_no);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<OutboundAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [editingItem, setEditingItem] = useState<OutboundItem | null>(null);
  const [itemQty, setItemQty] = useState("");
  const [itemBoxCount, setItemBoxCount] = useState("");
  const [itemRemark, setItemRemark] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);

  const [currentOrder, setCurrentOrder] = useState(normalizedOrder);
  useEffect(() => {
    setCurrentOrder(normalizedOrder);
  }, [normalizedOrder]);
  useEffect(() => {
    if (!dialogOpen || editingBox) return;
    const initial: Record<string, string> = {};
    for (const item of currentOrder.items) {
      initial[item.id] = "0";
    }
    setBoxItemQtyById(initial);
  }, [dialogOpen, editingBox, currentOrder.items]);
  useEffect(() => {
    let cancelled = false;
    listSalesChannels()
      .then((rows) => {
        if (!cancelled) setSalesChannels(rows);
      })
      .catch(() => {
        if (!cancelled) setSalesChannels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const currentAction = actionByStatus(currentOrder.status);
  const canMutate = ready && canWrite && currentOrder.status !== "cancelled";
  const shortageItems = useMemo(
    () => currentOrder.items.filter((item) => item.status === "shortage"),
    [currentOrder.items]
  );
  const reallocationItems = useMemo(
    () => currentOrder.items.filter((item) => item.status === "reallocate"),
    [currentOrder.items]
  );
  const totalRequestedQty = useMemo(
    () => currentOrder.items.reduce((sum, item) => sum + item.requested_qty, 0),
    [currentOrder.items]
  );
  const totalAllocatableQty = useMemo(
    () => currentOrder.items.reduce((sum, item) => sum + item.allocatable_qty, 0),
    [currentOrder.items]
  );
  const totalNetworkAllocatableQty = useMemo(
    () => currentOrder.items.reduce((sum, item) => sum + item.network_allocatable_qty, 0),
    [currentOrder.items]
  );
  const activeSalesChannels = useMemo(
    () => salesChannels.filter((channel) => channel.status === "active"),
    [salesChannels]
  );

  const setTabWithQuery = (nextTab: string) => {
    const normalized = normalizeTab(nextTab);
    setTab(normalized);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", normalized);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const openActionConfirm = () => {
    if (!currentAction) return;
    setPendingAction(currentAction);
    setConfirmOpen(true);
  };

  const runStatusAction = async () => {
    if (!pendingAction) return;

    setLoading(true);
    try {
      const updated = await transitionOutboundStatus(currentOrder.outbound_no, pendingAction);
      setCurrentOrder(normalizeOutboundOrder(updated));
      setConfirmOpen(false);
      pushToast({
        title: `${t(actionLabel(pendingAction))} ${t("completed")}`,
        description: `${t("Order status changed to")} ${t(updated.status)}.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Action failed");
      pushToast({ title: t("Action failed"), description: message, variant: "error" });
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const openEdit = () => {
    setEditDate(currentOrder.eta_date);
    setEditSalesChannel(currentOrder.memo === "N/A" ? "" : currentOrder.memo);
    setEditOrderNo(currentOrder.order_no);
    setEditTrackingNo(currentOrder.tracking_no);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const updated = await updateOutboundOrderDetails(currentOrder.outbound_no, {
        order_date: editDate,
        sales_channel: editSalesChannel.trim() || null,
        order_no: editOrderNo.trim() || null,
        tracking_no: editTrackingNo.trim() || null,
      });
      setCurrentOrder(normalizeOutboundOrder(updated));
      setEditOpen(false);
      pushToast({ title: "Outbound updated", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Update failed";
      pushToast({ title: "Update failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const runCancel = async () => {
    setLoading(true);
    try {
      const updated = await cancelOutboundOrder(currentOrder.outbound_no);
      setCurrentOrder(normalizeOutboundOrder(updated));
      setCancelOpen(false);
      pushToast({ title: "Outbound cancelled", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Cancel failed";
      pushToast({ title: "Cancel failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const openItemEdit = (item: OutboundItem) => {
    setEditingItem(item);
    setItemQty(String(item.requested_qty));
    setItemBoxCount(String(item.box_count ?? 0));
    setItemRemark(item.remark ?? "");
    setItemError(null);
  };

  const saveItemEdit = async () => {
    if (!editingItem) return;
    const qty = Number(itemQty);
    const boxCount = Number(itemBoxCount);
    if (!Number.isInteger(qty) || qty <= 0) {
      setItemError("Qty must be a positive integer.");
      return;
    }
    if (!Number.isInteger(boxCount) || boxCount < 0) {
      setItemError("Box count must be zero or greater.");
      return;
    }
    if (!editingItem.product_id || !editingItem.lot_id) {
      setItemError("This item is missing product or LOT metadata. Reload the page and try again.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateOutboundItem(currentOrder.outbound_no, editingItem.id, {
        product_id: editingItem.product_id,
        lot_id: editingItem.lot_id,
        location_id: editingItem.location_id ?? null,
        qty,
        box_type: editingItem.box_type ?? null,
        box_count: boxCount,
        remark: itemRemark.trim() || null,
      });
      setCurrentOrder(normalizeOutboundOrder(updated));
      setEditingItem(null);
      pushToast({ title: "Outbound item updated", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Item update failed";
      setItemError(message);
      pushToast({ title: "Item update failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const removeOutboundItem = async (item: OutboundItem) => {
    if (!window.confirm(`Delete item ${item.product_name}?`)) return;
    setLoading(true);
    try {
      const updated = await deleteOutboundItem(currentOrder.outbound_no, item.id);
      setCurrentOrder(normalizeOutboundOrder(updated));
      pushToast({ title: "Outbound item deleted", variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Item delete failed";
      pushToast({ title: "Item delete failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = useMemo(
    () => [
      { key: "barcode_full", label: "Barcode", render: (row: OutboundOrder["items"][number]) => row.barcode_full },
      {
        key: "product_name",
        label: "Product",
        render: (row: OutboundOrder["items"][number]) => {
          const href = buildProductHistoryHref(row.product_id, "outbound_ship");
          return href ? (
            <Link href={href} className="font-medium text-slate-900 hover:underline">
              {row.product_name}
            </Link>
          ) : row.product_name;
        },
      },
      { key: "lot", label: "Lot", render: (row: OutboundOrder["items"][number]) => row.lot },
      { key: "expiry_date", label: "Expiry Date", render: (row: OutboundOrder["items"][number]) => row.expiry_date ?? "-" },
      { key: "location", label: "Location", render: (row: OutboundOrder["items"][number]) => row.location },
      { key: "box_type", label: "Box Type", render: (row: OutboundOrder["items"][number]) => row.box_type ?? "-" },
      {
        key: "box_count",
        label: "Box Count",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.box_count ?? 0,
      },
      {
        key: "requested_qty",
        label: "Requested Qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.requested_qty,
      },
      {
        key: "picked_qty",
        label: "Picked Qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.picked_qty,
      },
      {
        key: "available_qty",
        label: "Available Qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.available_qty,
      },
      {
        key: "reserved_qty",
        label: "Reserved Qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.reserved_qty,
      },
      {
        key: "allocatable_qty",
        label: "Allocatable Qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.allocatable_qty,
      },
      {
        key: "status",
        label: "Status",
        render: (row: OutboundOrder["items"][number]) =>
          row.status === "shortage" ? (
            <Badge variant="danger" className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("Allocatable Shortage")}
            </Badge>
          ) : row.status === "reallocate" ? (
            <Badge variant="warning">{t("Reallocate Needed")}</Badge>
          ) : (
            <Badge variant={row.status === "picked" ? "success" : "default"}>{t(row.status)}</Badge>
          ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row: OutboundOrder["items"][number]) =>
          canMutate ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                data-testid={`outbound-item-edit-${row.id}`}
                aria-label={`Edit outbound item ${row.product_name}`}
                title={`Edit outbound item ${row.product_name}`}
                onClick={() => openItemEdit(row)}
                disabled={loading}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Item
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-700"
                data-testid={`outbound-item-delete-${row.id}`}
                aria-label={`Delete outbound item ${row.product_name}`}
                title={`Delete outbound item ${row.product_name}`}
                onClick={() => void removeOutboundItem(row)}
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Item
              </Button>
            </div>
          ) : null,
      },
    ],
    [canMutate, loading, t]
  );

  const buildEmptyBoxItems = () =>
    currentOrder.items.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = "0";
      return acc;
    }, {});

  const resetBoxForm = () => {
    setEditingBox(null);
    setBoxNo("");
    setCourier("");
    setTrackingNo("");
    setBoxItemQtyById({});
    setFormError(null);
  };

  const openAddBox = () => {
    setEditingBox(null);
    setBoxNo("");
    setCourier("");
    setTrackingNo("");
    setBoxItemQtyById(buildEmptyBoxItems());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditBox = (box: OutboundBox) => {
    const qtyById = buildEmptyBoxItems();
    for (const item of box.items) {
      qtyById[item.outbound_item_id] = String(item.packed_qty);
    }
    setEditingBox(box);
    setBoxNo(box.box_no);
    setCourier(box.courier === "N/A" ? "" : box.courier);
    setTrackingNo(box.tracking_no === "-" ? "" : box.tracking_no);
    setBoxItemQtyById(qtyById);
    setFormError(null);
    setDialogOpen(true);
  };

  const closeBoxDialog = () => {
    setDialogOpen(false);
    resetBoxForm();
  };

  const submitBox = async () => {
    const selectedItems = Object.entries(boxItemQtyById)
      .map(([outbound_item_id, value]) => ({ outbound_item_id, packed_qty: Number(value) }))
      .filter((item) => Number.isFinite(item.packed_qty) && item.packed_qty > 0);
    const parsedItemCount = selectedItems.reduce((sum, item) => sum + item.packed_qty, 0);
    if (!boxNo.trim() || !courier.trim() || !trackingNo.trim()) {
      setFormError(t("All fields are required."));
      return;
    }
    if (selectedItems.length === 0) {
      setFormError(t("Select at least one packed item."));
      return;
    }
    if (!Number.isFinite(parsedItemCount) || parsedItemCount < 1) {
      setFormError(t("Item count must be 1 or greater."));
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const payload = {
        box_no: boxNo.trim(),
        courier: courier.trim(),
        tracking_no: trackingNo.trim(),
        item_count: parsedItemCount,
        items: selectedItems,
      };
      const boxes = editingBox
        ? await updateOutboundBox(currentOrder.outbound_no, editingBox.id, { ...payload, status: editingBox.status })
        : await addOutboundBox(currentOrder.outbound_no, payload);
      setCurrentOrder((prev) => normalizeOutboundOrder({ ...prev, boxes }));
      closeBoxDialog();
      pushToast({ title: editingBox ? t("Box updated") : t("Box added"), variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Please check input values or API status.");
      pushToast({
        title: editingBox ? t("Failed to update box") : t("Failed to add box"),
        description: message,
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeBox = async (box: OutboundBox) => {
    if (!window.confirm(`${t("Delete Box")} ${box.box_no}?`)) return;
    setLoading(true);
    try {
      const boxes = await deleteOutboundBox(currentOrder.outbound_no, box.id);
      setCurrentOrder((prev) => normalizeOutboundOrder({ ...prev, boxes }));
      pushToast({ title: t("Box deleted"), variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Please check input values or API status.");
      pushToast({ title: t("Failed to delete box"), description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <PageHeader
        breadcrumbs={[
          { label: "Operations" },
          { label: "Outbounds", href: "/outbounds" },
          { label: currentOrder.outbound_no },
        ]}
        title={currentOrder.outbound_no}
        subtitle={`${currentOrder.client} | ${t("ETA")} ${currentOrder.eta_date}`}
        rightSlot={
          <div className="flex items-center gap-2">
            <StatusBadge status={currentOrder.status} />
            {canMutate && (
              <Button variant="secondary" onClick={openEdit} disabled={loading}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canMutate && (
              <Button variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => setCancelOpen(true)} disabled={loading}>
                <Ban className="h-4 w-4" />
                Cancel
              </Button>
            )}
            {canMutate && currentAction && (
              <Button onClick={openActionConfirm} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t(actionLabel(currentAction))}
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTabWithQuery}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
          <TabsTrigger value="items">{t("Items")}</TabsTrigger>
          <TabsTrigger value="boxes">{t("Boxes")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("Timeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("Client")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{currentOrder.client}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Shipping Address")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{currentOrder.ship_to}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{t(currentOrder.summary)}</p>
              <p className="text-sm text-slate-500">{t(currentOrder.memo)}</p>
              <p className="text-sm text-slate-500">{`${t("Order No")}: ${currentOrder.order_no || "-"}`}</p>
              <p className="text-sm text-slate-500">{`${t("Tracking No")}: ${currentOrder.tracking_no || "-"}`}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={shortageItems.length > 0 ? "danger" : "success"}>
                  {shortageItems.length > 0
                    ? `${t("Shortage Items")}: ${shortageItems.length}`
                    : t("Allocatable OK")}
                </Badge>
                <Badge variant={reallocationItems.length > 0 ? "warning" : "default"}>
                  {`${t("Reallocation Items")}: ${reallocationItems.length}`}
                </Badge>
                <Badge variant="info">
                  {`${t("Requested Qty")}: ${totalRequestedQty}`}
                </Badge>
                <Badge variant={totalAllocatableQty < totalRequestedQty ? "warning" : "default"}>
                  {`${t("Allocatable Qty")}: ${totalAllocatableQty}`}
                </Badge>
                <Badge variant={totalNetworkAllocatableQty < totalRequestedQty ? "danger" : "success"}>
                  {`${t("Network Allocatable Qty")}: ${totalNetworkAllocatableQty}`}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items">
          <DataTable rows={currentOrder.items} columns={itemColumns} emptyText={t("No items available.")} />
          {["shipped", "delivered"].includes(currentOrder.status) && (
            <p className="mt-3 text-sm text-amber-700">
              출고 완료 후에는 아이템을 추가할 수 없습니다. draft에서 아이템을 먼저 등록한 뒤 Ship 하세요.
            </p>
          )}
          {reallocationItems.length > 0 && (
            <div className="mt-4 rounded-xl border bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">{t("Reallocation Suggestions")}</p>
              <div className="mt-3 space-y-3">
                {reallocationItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-amber-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.product_name}</span>
                      <Badge variant="warning">{`${t("Current Location")}: ${item.location}`}</Badge>
                      <Badge variant="info">{`${t("Requested Qty")}: ${item.requested_qty}`}</Badge>
                      <Badge variant="default">{`${t("Network Allocatable Qty")}: ${item.network_allocatable_qty}`}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.allocation_plan.map((plan) => (
                        <Badge key={`${item.id}-${plan.location}`} variant={plan.location === item.location ? "default" : "info"}>
                          {`${plan.lot} @ ${plan.location} ${t("Suggested Qty")}: ${plan.suggested_qty} / ${t("Allocatable Qty")}: ${plan.allocatable_qty}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {shortageItems.length > 0 && (
            <div className="mt-4 rounded-xl border bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-900">{t("Shortage Alerts")}</p>
              <div className="mt-3 space-y-2">
                {shortageItems.map((item) => (
                  <div key={`shortage-${item.id}`} className="flex flex-wrap items-center gap-2 text-sm text-rose-800">
                    <span className="font-medium">{item.product_name}</span>
                    <span>{`${t("Current Location")}: ${item.location}`}</span>
                    <span>{`${t("Shortage Qty")}: ${item.shortage_qty}`}</span>
                    <span>{`${t("Network Allocatable Qty")}: ${item.network_allocatable_qty}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="boxes">
          <div className="mb-4 flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeBoxDialog())}>
              <Button
                variant="secondary"
                disabled={!canMutate || !currentOrder.boxes_supported}
                title={!currentOrder.boxes_supported ? t("Box API is unavailable in current backend.") : undefined}
                onClick={openAddBox}
              >
                <PackagePlus className="h-4 w-4" />
                {t("Add Box")}
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBox ? t("Edit Box") : t("Add Box")}</DialogTitle>
                  <DialogDescription>Enter the box details to save them on this outbound order.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder={t("Box No")} value={boxNo} onChange={(e) => setBoxNo(e.target.value)} />
                  <Input placeholder={t("Courier")} value={courier} onChange={(e) => setCourier(e.target.value)} />
                  <Input placeholder={t("Tracking No")} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                  <div className="rounded-md border">
                    <div className="border-b bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t("Packed Items")}
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {currentOrder.items.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-slate-500">{t("No items available.")}</p>
                      ) : (
                        currentOrder.items.map((item) => (
                          <label key={item.id} className="grid grid-cols-[1fr_96px] gap-3 border-b px-3 py-2 last:border-b-0">
                            <span className="min-w-0 text-sm">
                              <span className="block truncate font-medium">{item.product_name}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {item.barcode_full} | {item.lot} | {item.location} | {t("Requested Qty")}: {item.requested_qty}
                              </span>
                            </span>
                            <Input
                              aria-label={`${item.product_name} ${t("Packed Qty")}`}
                              type="number"
                              min={0}
                              max={item.requested_qty}
                              value={boxItemQtyById[item.id] ?? "0"}
                              onChange={(e) => setBoxItemQtyById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            />
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={closeBoxDialog} disabled={loading}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={submitBox} disabled={loading}>
                    {loading ? t("Saving...") : t("Save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {currentOrder.boxes_supported && currentOrder.boxes.length === 0 ? (
            <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No box records are saved for this outbound order yet. Use Add Box to enter box no, courier, tracking no, and packed item qty.
            </div>
          ) : null}
          <DataTable
            rows={currentOrder.boxes}
            columns={[
              { key: "box_no", label: "Box No", render: (row) => row.box_no },
              { key: "courier", label: "Courier", render: (row) => row.courier },
              { key: "tracking_no", label: "Tracking No", render: (row) => row.tracking_no },
              {
                key: "items",
                label: "Packed Items",
                render: (row) =>
                  row.items.length === 0 ? (
                    "-"
                  ) : (
                    <div className="space-y-1">
                      {row.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          <span className="font-medium">{item.product_name}</span>
                          <span className="text-slate-500"> / {item.lot} / {item.location}</span>
                          <span className="tabular-nums"> x {item.packed_qty}</span>
                        </div>
                      ))}
                    </div>
                  ),
              },
              {
                key: "item_count",
                label: "Item Count",
                className: "tabular-nums",
                render: (row) => row.item_count,
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) =>
                  canMutate ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Edit box ${row.box_no}`}
                        title={`Edit box ${row.box_no}`}
                        onClick={() => openEditBox(row)}
                        disabled={loading || !currentOrder.boxes_supported}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Box
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-700"
                        aria-label={`Delete box ${row.box_no}`}
                        title={`Delete box ${row.box_no}`}
                        onClick={() => void removeBox(row)}
                        disabled={loading || !currentOrder.boxes_supported}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Box
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
            emptyText="No boxes packed yet."
          />
          {!currentOrder.boxes_supported && (
            <p className="mt-3 text-sm text-amber-700">
              {t("Box API is unavailable on current backend, so box create/update is disabled.")}
            </p>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          {currentOrder.timeline.length === 0 ? (
            <div className="rounded-xl border bg-white px-6 py-8 text-center text-sm text-slate-500">{t("No timeline logs.")}</div>
          ) : (
            <div className="rounded-xl border bg-white px-6 py-2">
              {currentOrder.timeline.map((log, idx) => (
                <div key={log.id} className="relative flex gap-4 py-4">
                  <div className="flex w-5 flex-col items-center">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
                    {idx < currentOrder.timeline.length - 1 && <span className="mt-1 h-full w-px bg-slate-200" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(log.title)}</p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
                      {log.at} | {log.actor}
                    </p>
                    {log.note && <p className="mt-1 text-sm text-slate-600">{t(log.note)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Confirm")} {pendingAction ? t(actionLabel(pendingAction)) : t("Action")}</DialogTitle>
            <DialogDescription>
              This changes outbound status and updates stock and billing effects through the API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loading}>
              {t("Cancel")}
            </Button>
            <Button onClick={runStatusAction} disabled={loading || !pendingAction}>
              {loading ? t("Processing...") : t("Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Outbound Edit</DialogTitle>
            <DialogDescription>
              Adjust basic outbound details. Use Allocate, Pack, Ship, or Cancel for process status changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              Date
              <Input className="mt-1" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Sales channel
              <select
                className="mt-1 h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                value={editSalesChannel}
                onChange={(event) => setEditSalesChannel(event.target.value)}
              >
                <option value="">Select sales channel</option>
                {activeSalesChannels.map((channel) => (
                  <option key={channel.id} value={channel.name}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Order No
              <Input className="mt-1" value={editOrderNo} onChange={(event) => setEditOrderNo(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Tracking No
              <Input className="mt-1" value={editTrackingNo} onChange={(event) => setEditTrackingNo(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={loading || !editDate}>{loading ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Outbound</DialogTitle>
            <DialogDescription>
              This changes the outbound status to cancelled. If reservation or shipment was already applied, related stock and billing effects are rolled back by the API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)} disabled={loading}>Keep Order</Button>
            <Button className="bg-rose-700 hover:bg-rose-800" onClick={() => void runCancel()} disabled={loading}>
              {loading ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingItem)} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Outbound Item</DialogTitle>
            <DialogDescription>
              Adjust requested quantity, box count, or remark. Product, LOT, and location stay fixed for stock traceability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-600">
              Qty
              <Input className="mt-1" type="number" min={1} value={itemQty} onChange={(event) => setItemQty(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Box Count
              <Input className="mt-1" type="number" min={0} value={itemBoxCount} onChange={(event) => setItemBoxCount(event.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Remark
              <Input className="mt-1" value={itemRemark} onChange={(event) => setItemRemark(event.target.value)} />
            </label>
            {itemError ? <p className="text-sm text-rose-700">{itemError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingItem(null)} disabled={loading}>Cancel</Button>
            <Button onClick={() => void saveItemEdit()} disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}



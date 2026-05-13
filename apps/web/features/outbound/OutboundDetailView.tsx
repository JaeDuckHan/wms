"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OutboundAction, OutboundOrder } from "@/features/outbound/types";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/DataTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addOutboundBox, ApiError, transitionOutboundStatus } from "@/features/outbound/api";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
        location: asText(item.location),
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

  const [tab, setTab] = useState<TabValue>(normalizeTab(initialTab));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boxNo, setBoxNo] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [itemCount, setItemCount] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<OutboundAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const normalizedOrder = useMemo(() => normalizeOutboundOrder(initialOrder), [initialOrder]);
  const [currentOrder, setCurrentOrder] = useState(normalizedOrder);
  useEffect(() => {
    setCurrentOrder(normalizedOrder);
  }, [normalizedOrder]);
  const currentAction = actionByStatus(currentOrder.status);
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

  const itemColumns = useMemo(
    () => [
      { key: "barcode_full", label: "barcode_full", render: (row: OutboundOrder["items"][number]) => row.barcode_full },
      { key: "product_name", label: "product_name", render: (row: OutboundOrder["items"][number]) => row.product_name },
      { key: "lot", label: "lot", render: (row: OutboundOrder["items"][number]) => row.lot },
      { key: "location", label: "location", render: (row: OutboundOrder["items"][number]) => row.location },
      {
        key: "requested_qty",
        label: "requested_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.requested_qty,
      },
      {
        key: "picked_qty",
        label: "picked_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.picked_qty,
      },
      {
        key: "available_qty",
        label: "available_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.available_qty,
      },
      {
        key: "reserved_qty",
        label: "reserved_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.reserved_qty,
      },
      {
        key: "allocatable_qty",
        label: "allocatable_qty",
        className: "tabular-nums",
        render: (row: OutboundOrder["items"][number]) => row.allocatable_qty,
      },
      {
        key: "status",
        label: "status",
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
    ],
    [t]
  );

  const submitBox = async () => {
    const parsedItemCount = Number(itemCount);
    if (!boxNo.trim() || !courier.trim() || !trackingNo.trim()) {
      setFormError(t("All fields are required."));
      return;
    }
    if (!Number.isFinite(parsedItemCount) || parsedItemCount < 1) {
      setFormError(t("Item count must be 1 or greater."));
      return;
    }

    setFormError(null);
    setLoading(true);
    try {
      const boxes = await addOutboundBox(currentOrder.outbound_no, {
        box_no: boxNo.trim(),
        courier: courier.trim(),
        tracking_no: trackingNo.trim(),
        item_count: parsedItemCount,
      });
      setCurrentOrder((prev) => normalizeOutboundOrder({ ...prev, boxes }));
      setDialogOpen(false);
      setBoxNo("");
      setCourier("");
      setTrackingNo("");
      setItemCount("1");
      pushToast({ title: t("Box added"), variant: "success" });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("Please check input values or API status.");
      pushToast({ title: t("Failed to add box"), description: message, variant: "error" });
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
            {currentAction && (
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
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={!currentOrder.boxes_supported} title={!currentOrder.boxes_supported ? t("Box API is unavailable in current backend.") : undefined}>
                  <PackagePlus className="h-4 w-4" />
                  {t("Add Box")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("Add Box")}</DialogTitle>
                  <DialogDescription>{t("Mock form with client-side validation.")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input placeholder={t("Box No")} value={boxNo} onChange={(e) => setBoxNo(e.target.value)} />
                  <Input placeholder={t("Courier")} value={courier} onChange={(e) => setCourier(e.target.value)} />
                  <Input placeholder={t("Tracking No")} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                  <Input
                    placeholder={t("Item Count")}
                    type="number"
                    min={1}
                    value={itemCount}
                    onChange={(e) => setItemCount(e.target.value)}
                  />
                  {formError && <p className="text-sm text-red-600">{formError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={loading}>
                    {t("Cancel")}
                  </Button>
                  <Button onClick={submitBox} disabled={loading}>
                    {loading ? t("Saving...") : t("Save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <DataTable
            rows={currentOrder.boxes}
            columns={[
              { key: "box_no", label: "Box No", render: (row) => row.box_no },
              { key: "courier", label: "Courier", render: (row) => row.courier },
              { key: "tracking_no", label: "Tracking No", render: (row) => row.tracking_no },
              {
                key: "item_count",
                label: "Item Count",
                className: "tabular-nums",
                render: (row) => row.item_count,
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
              {t("This changes outbound status and appends a timeline log in mock data.")}
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
    </section>
  );
}


